import { Body, Illumination, MakeTime, Observer, Rotation_EQJ_HOR } from "astronomy-engine";
import type {
  BestMoment,
  HiddenObject,
  NightPlan,
  ObjectKind,
  PlanInput,
  RankedObject,
  TrackPoint,
} from "./types";
import { resolveInput } from "./input";
import { bodyPosition, bodies, catalog, catalogPosition, separation } from "./positions";
import { cloudAt, clockFormatter, HOUR, nightWindow } from "./time";
import { darkness, moonInfo, nightDarkness, skyEvents } from "./sky";
import { effectiveMagnitude, limitingMagnitude } from "./brightness";
import { rankFactors } from "./rank";
import { summary } from "./describe";
import { verdict } from "./verdict";
export type * from "./types";
export { parsePlanInput, PlanInputError, resolveTimeZone } from "./input";
export { catalog } from "./positions";

export function planNight(input: PlanInput): NightPlan {
  const resolved = resolveInput(input);
  const observer = new Observer(resolved.latitude, resolved.longitude, resolved.elevationMeters);
  const window = nightWindow(resolved.date, resolved.timeZone);
  const start = Date.parse(window.start),
    end = Date.parse(window.end);
  const clock = clockFormatter(resolved.timeZone);
  const events = skyEvents(observer, start, end);
  const { condition, darkWindow } = nightDarkness(observer, start, end, events);
  const moon = moonInfo(observer, start, end, darkWindow);
  const step = resolved.stepMinutes * 60000;
  const samples = [];
  for (let t = start; ; t = Math.min(end, t + step)) {
    const time = MakeTime(new Date(t));
    const sun = bodyPosition(Body.Sun, time, observer);
    const moonPosition = bodyPosition(Body.Moon, time, observer);
    const illumination = Illumination(Body.Moon, time);
    samples.push({
      time,
      iso: time.date.toISOString(),
      sun,
      moon: moonPosition,
      illumination,
      rotation: Rotation_EQJ_HOR(time, observer),
      cloud: cloudAt(t, resolved.cloudCover),
      duration: Math.min(step, end - t) / HOUR,
    });
    if (t === end) break;
  }
  const timeline = samples.map((s) => ({
    time: s.iso,
    sunAltDeg: s.sun.altDeg,
    moonAltDeg: s.moon.altDeg,
    darkness: darkness(s.sun.altDeg),
    cloudPercent: s.cloud,
    zenithLimitingMag:
      s.sun.altDeg >= -0.833
        ? null
        : limitingMagnitude(
            resolved.sky,
            resolved.equipment,
            s.sun.altDeg,
            90,
            s.moon.altDeg,
            s.illumination.phase_angle,
            90 - s.moon.altDeg,
          ),
  }));
  const targets = [
    ...bodies.map((body) => ({
      id: body.toLowerCase(),
      name: String(body),
      kind: body === Body.Moon ? ("moon" as const) : ("planet" as const),
      constellation: null,
      source: { body },
    })),
    ...catalog.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      constellation: row.constellation,
      source: { row },
    })),
  ];
  const objects: RankedObject[] = [],
    hidden: HiddenObject[] = [];
  for (const target of targets) {
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
      peakAltDeg = Math.max(peakAltDeg, pos.altDeg);
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
      hidden.push({
        id: target.id,
        name: target.name,
        kind,
        reason: !highInDark
          ? "Never gets higher than 10° while the sky is dark."
          : !brightInDark
            ? "Too faint for this sky and equipment."
            : "Clouds block every otherwise visible moment.",
      });
      continue;
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
    objects.push({
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
    });
  }
  objects.sort(
    (a, b) => b.score - a.score || b.best.marginMag - a.best.marginMag || a.name.localeCompare(b.name),
  );
  objects.forEach((o, i) => {
    o.rank = i + 1;
  });
  return {
    input: resolved,
    window,
    condition,
    darkWindow,
    events,
    moon,
    timeline,
    verdict: verdict(resolved, darkWindow, moon, clock),
    objects,
    hidden,
  };
}
