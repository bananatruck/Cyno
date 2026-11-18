import type { NightCondition, NightPlan, ObjectKind } from "@cyno/engine";
import type { WeatherStatus } from "./weather";

/** Rounds to the nearest minute, as the engine does, so every clock time in the UI agrees with its reasons. */
export function formatTimeHHMM(isoString: string, timeZone: string): string {
  const ms = Date.parse(isoString);
  if (!Number.isFinite(ms)) return "--:--";
  const rounded = new Date(Math.round(ms / 60_000) * 60_000);
  const options = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } as const;
  try {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).format(rounded);
  } catch {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(rounded);
  }
}

/** "Dark 18:15 to 05:01 (10.8 hours). Waxing Gibbous Moon, 58% lit, up for 5.8 dark hours." */
export function formatDarkAndMoonSummary(plan: NightPlan): string | null {
  const dark = plan.darkWindow;
  if (!dark) return null;
  const zone = plan.input.timeZone;
  const { phaseName, illumination, hoursUpInDarkWindow } = plan.moon;
  const moonName = phaseName.endsWith("Moon") ? phaseName : `${phaseName} Moon`;
  const hoursUp = hoursUpInDarkWindow.toFixed(1);
  const moonUp = hoursUp === "0.0" ? "not up during the dark hours" : `up for ${hoursUp} dark hours`;
  return (
    `Dark ${formatTimeHHMM(dark.start, zone)} to ${formatTimeHHMM(dark.end, zone)} (${dark.hours.toFixed(1)} hours). ` +
    `${moonName}, ${Math.round(illumination * 100)}% lit, ${moonUp}.`
  );
}

/** The engine's dark-window and Moon sentences, which formatDarkAndMoonSummary already covers. */
const DARK_OR_MOON_REASON = /^(Dark from \S+ to \S+ \(|The \d+% Moon is up for )/;

export function reasonsBesideDarkAndMoon(reasons: readonly string[]): string[] {
  return reasons.filter((reason) => !DARK_OR_MOON_REASON.test(reason));
}

export function describeWeatherStatus(status: WeatherStatus | "loading"): string {
  switch (status) {
    case "loading":
      return "Checking the Open-Meteo cloud forecast.";
    case "ok":
      return "Open-Meteo cloud forecast in use.";
    case "offline":
      return "No cloud forecast (offline). Ranking ignores clouds.";
    case "out-of-range":
      return "No cloud forecast for this date (Open-Meteo covers the next 16 days). Ranking ignores clouds.";
    case "unavailable":
      return "No cloud forecast available right now. Ranking ignores clouds.";
  }
}

export function formatSignedPoints(points: number): string {
  const rounded = Math.round(points * 10) / 10;
  if (Object.is(rounded, -0) || rounded === 0) return "+0";
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return rounded > 0 ? `+${text}` : text;
}

export function formatObjectKind(kind: ObjectKind): string {
  switch (kind) {
    case "moon":
      return "Moon";
    case "planet":
      return "Planet";
    case "star":
      return "Star";
    case "double-star":
      return "Double star";
    case "open-cluster":
      return "Open cluster";
    case "globular-cluster":
      return "Globular cluster";
    case "nebula":
      return "Nebula";
    case "planetary-nebula":
      return "Planetary nebula";
    case "galaxy":
      return "Galaxy";
    case "other":
      return "Deep sky";
  }
}

export function describeConditionDirection(condition: NightCondition): {
  title: string;
  suggestion: string;
} | null {
  switch (condition) {
    case "polar-day":
      return {
        title: "Polar day: the Sun stays above the horizon all night.",
        suggestion: "Try a date in autumn or winter, or choose a location further south.",
      };
    case "white-night":
      return {
        title: "White night: the Sun sets briefly but stays in civil twilight above -6°.",
        suggestion: "Try a date closer to winter or choose a place at a lower latitude.",
      };
    case "no-nautical-darkness":
      return {
        title: "Bright twilight persists: the Sun never drops below -12° tonight.",
        suggestion:
          "Bright planets and stars are still visible, or try a date outside summer for deep-sky viewing.",
      };
    case "no-astronomical-darkness":
      return {
        title: "Astronomical twilight persists: the Sun stays above -18° at midnight.",
        suggestion:
          "Faint galaxies and nebulae will be washed out; try a darker season or use a telescope on bright clusters.",
      };
    case "polar-night":
      return {
        title: "Polar night: the Sun stays below the horizon for the entire 24-hour window.",
        suggestion: "Use the timeline scrubber to pick the darkest hours with the lowest Moon altitude.",
      };
    case "normal":
      return null;
  }
}
