import { Body, Illumination } from "astronomy-engine";
import type { AstroTime, Observer, RotationMatrix } from "astronomy-engine";
import type { CatalogObject } from "./positions";
import type { BestMoment, HiddenObject, ObjectKind, RankedObject, ResolvedInput, TrackPoint } from "./types";
import { bodyPosition, catalogPosition, separation } from "./positions";
import { effectiveMagnitude, limitingMagnitude } from "./brightness";
import { darkness } from "./sky";
import { rankFactors } from "./rank";
import { summary } from "./describe";

type Sample = {
  time: AstroTime;
  iso: string;
  sun: { altDeg: number; azDeg: number };
  moon: { altDeg: number; azDeg: number };
  illumination: { mag: number; phase_fraction: number; phase_angle: number };
  rotation: RotationMatrix;
  cloud: number | null;
  duration: number;
};

type Target = {
  id: string;
  name: string;
  kind: ObjectKind;
  constellation: string | null;
  source: { body: Body } | { row: CatalogObject };
};

export function evaluateTarget(
  target: Target,
  samples: Sample[],
  observer: Observer,
  resolved: ResolvedInput,
  clock: (time: string) => string,
  skyGetsDark: boolean,
): RankedObject | HiddenObject {
  const track: TrackPoint[] = [];
  let best: {
    moment: BestMoment;
    noMoon: number;
    separation: number | null;
    illumination: number;
    magnitude: number;
  } | null = null;
  let visibleFrom = "",
    visibleTo = "",
    hoursVisible = 0,
    peakAltDeg = -90;
  let highInDark = false,
    brightInDark = false;
  const kind: ObjectKind = target.kind;
  for (const s of samples) {
    const pos =
      "body" in target.source
        ? target.source.body === Body.Moon
          ? s.moon
          : bodyPosition(target.source.body, s.time, observer)
        : catalogPosition(target.source.row, s.time, s.rotation);
    track.push({ time: s.iso, ...pos });
    // Culmination can fall in daylight; peak altitude is dark-sky only when darkness exists tonight.
    const countsForPeak = !skyGetsDark || s.sun.altDeg < -0.833;
    if (countsForPeak) peakAltDeg = Math.max(peakAltDeg, pos.altDeg);
    if (s.sun.altDeg >= -0.833 || pos.altDeg < 10) continue;
    highInDark = true;
    const mag =
      "body" in target.source
        ? target.source.body === Body.Moon
          ? s.illumination.mag
          : Illumination(target.source.body, s.time).mag
        : target.source.row.mag;
    const sep = kind === "moon" ? null : separation(pos, s.moon);
    const limit = (includeMoon: boolean) =>
      limitingMagnitude(
        resolved.sky,
        resolved.equipment,
        s.sun.altDeg,
        pos.altDeg,
        s.moon.altDeg,
        s.illumination.phase_angle,
        sep ?? 0,
        includeMoon && kind !== "moon",
      );
    const effective = effectiveMagnitude(mag, pos.altDeg, kind);
    const limitingMag = limit(true),
      margin = limitingMag - effective;
    if (margin < 0) continue;
    brightInDark = true;
    if (s.cloud !== null && s.cloud >= 80) continue;
    if (!visibleFrom) visibleFrom = s.iso;
    visibleTo = s.iso;
    hoursVisible += s.duration;
    if (
      !best ||
      margin > best.moment.marginMag ||
      (margin === best.moment.marginMag && pos.altDeg > best.moment.altDeg)
    )
      best = {
        moment: {
          time: s.iso,
          ...pos,
          limitingMag,
          effectiveMag: effective,
          marginMag: margin,
          cloudPercent: s.cloud,
          darkness: darkness(s.sun.altDeg),
        },
        noMoon: limit(false) - effective,
        separation: sep,
        illumination: s.illumination.phase_fraction,
        magnitude: mag,
      };
  }
  if (!best) {
    const reason = !skyGetsDark
      ? "The sky never gets dark here tonight."
      : !highInDark
        ? "Never gets higher than 10° while the sky is dark."
        : !brightInDark
          ? "Too faint for this sky and equipment."
          : "Clouds block every otherwise visible moment.";
    return {
      id: target.id,
      name: target.name,
      kind,
      reason,
    };
  }
  const factors = rankFactors(
    best.moment,
    hoursVisible,
    best.noMoon,
    best.separation,
    best.illumination,
    clock,
  );
  const score = Math.round(factors.reduce((sum, f) => sum + f.points, 0) * 10) / 10;
  return {
    id: target.id,
    name: target.name,
    kind,
    rank: 0,
    score,
    magnitude: best.magnitude,
    constellation: target.constellation,
    best: best.moment,
    visibleFrom,
    visibleTo,
    hoursVisible,
    peakAltDeg,
    moonSeparationDeg: best.separation,
    factors,
    summary: summary(best.moment.time, best.moment.altDeg, best.moment.azDeg, clock),
    track,
  };
}
