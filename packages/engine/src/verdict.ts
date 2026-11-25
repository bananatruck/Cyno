import type { DarkWindow, MoonInfo, NightCondition, Verdict } from "./types";
import { clamp } from "./rank";
import { cloudAtParsed, HOUR, type ParsedCloudCover } from "./time";

/** One sentence for the scored dark window, wording depends on how dark the sky gets. */
export function formatDarkWindowReason(
  dark: Pick<DarkWindow, "start" | "end" | "hours" | "level">,
  clock: (time: string) => string,
): string {
  const range = `${clock(dark.start)} to ${clock(dark.end)} (${dark.hours.toFixed(1)} hours)`;
  switch (dark.level) {
    case "night":
      return `Dark from ${range}.`;
    case "astronomical-twilight":
      return `Darkest from ${range}, in astronomical twilight: the sky never gets fully dark.`;
    case "nautical-twilight":
      return `Darkest from ${range}, in nautical twilight.`;
    default:
      return `Dark from ${range}.`;
  }
}
/** Time-weighted mean over dark-window spans covered by hourly forecast samples. */
export function meanCloud(
  dark: DarkWindow,
  parsedCloud: ParsedCloudCover | null,
): { mean: number; coveredFraction: number } | null {
  const a = Date.parse(dark.start),
    b = Date.parse(dark.end);
  const span = b - a;
  const edges = [
    ...new Set([
      a,
      b,
      ...(parsedCloud?.times ?? []).flatMap((t) => [t, t + HOUR]).filter((t) => t > a && t < b),
    ]),
  ].sort((x, y) => x - y);
  let weighted = 0;
  let covered = 0;
  for (let i = 1; i < edges.length; i++) {
    const left = edges[i - 1],
      right = edges[i];
    if (left === undefined || right === undefined) continue;
    const cloud = cloudAtParsed((left + right) / 2, parsedCloud);
    if (cloud === null) continue;
    const width = right - left;
    weighted += cloud * width;
    covered += width;
  }
  const coveredFraction = covered / span;
  if (coveredFraction < 0.5) return null;
  return { mean: weighted / covered, coveredFraction };
}
function limitedDarknessReason(condition: NightCondition, lowestSunAltDeg: number): string {
  const belowHorizon = Math.round(Math.min(0, lowestSunAltDeg) * -1);
  switch (condition) {
    case "polar-day":
      return "The Sun never sets here tonight.";
    case "white-night":
      return "The Sun sets but stays within 6° of the horizon, so the sky never gets dark.";
    case "no-nautical-darkness":
      return `The sky only reaches nautical twilight: the Sun gets no lower than ${belowHorizon}° below the horizon.`;
    case "no-astronomical-darkness":
      return `The sky only reaches astronomical twilight: the Sun gets no lower than ${belowHorizon}° below the horizon.`;
    default:
      return "There is no astronomical darkness tonight.";
  }
}

export function verdict(
  condition: NightCondition,
  dark: DarkWindow | null,
  moon: MoonInfo,
  clock: (time: string) => string,
  lowestSunAltDeg: number,
  parsedCloud: ParsedCloudCover | null,
): Verdict {
  // A missing or civil-twilight-only window has no usable darkness. Nautical twilight is
  // still scored without darkness points; extensive cloud cover can override that score.
  const usable = dark !== null && dark.level !== "civil-twilight";
  if (!usable)
    return {
      label: "no-go",
      score: 0,
      reasons: [limitedDarknessReason(condition, lowestSunAltDeg)],
    };
  const clouds = meanCloud(dark, parsedCloud);
  const base =
    (dark.level === "night" || dark.level === "astronomical-twilight" ? 40 * clamp(dark.hours / 4) : 0) +
    30 * (1 - moon.illumination * clamp(moon.hoursUpInDarkWindow / dark.hours));
  const score = clouds === null ? (base * 100) / 70 : base + 30 * (1 - clouds.mean / 100);
  // meanCloud requires forecast coverage of at least half the dark window.
  const cloudBlocked = clouds !== null && clouds.mean >= 80;
  return {
    label: cloudBlocked ? "no-go" : score >= 65 ? "go" : score >= 35 ? "marginal" : "no-go",
    score: cloudBlocked ? Math.min(score, 34) : score,
    reasons: [
      ...(cloudBlocked
        ? [`Clouds cover the sky for most of the dark hours (${Math.round(clouds.mean)}% on average).`]
        : []),
      ...(dark.level === "nautical-twilight" ? [limitedDarknessReason(condition, lowestSunAltDeg)] : []),
      formatDarkWindowReason(dark, clock),
      `The ${Math.round(moon.illumination * 100)}% Moon is up for ${moonHours(moon.hoursUpInDarkWindow)} dark hours.`,
      clouds === null
        ? "Cloud cover is unknown."
        : clouds.coveredFraction < 1
          ? `Cloud cover averages ${Math.round(clouds.mean)}% (forecast covers ${Math.round(clouds.coveredFraction * 100)}% of the dark hours).`
          : `Cloud cover averages ${Math.round(clouds.mean)}%.`,
    ],
  };
}

/** Hours to one decimal, except that a real interval shorter than that is not shown as 0.0. */
function moonHours(hours: number): string {
  return hours > 0 && hours < 0.05 ? "less than 0.1" : hours.toFixed(1);
}
