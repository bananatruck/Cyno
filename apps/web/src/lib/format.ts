import type { DarkWindow, NightCondition, NightPlan, ObjectKind } from "@cyno/engine";
import type { ForecastStatus } from "./weather";

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

function formatDarkWindowSummaryLine(dark: DarkWindow, timeZone: string): string {
  const range = `${formatTimeHHMM(dark.start, timeZone)} to ${formatTimeHHMM(dark.end, timeZone)} (${dark.hours.toFixed(1)} hours)`;
  switch (dark.level) {
    case "night":
      return `Dark ${range}.`;
    case "astronomical-twilight":
      return `Darkest ${range}, in astronomical twilight: the sky never gets fully dark.`;
    case "nautical-twilight":
      return `Darkest ${range}, in nautical twilight.`;
    default:
      return `Dark ${range}.`;
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
  return `${formatDarkWindowSummaryLine(dark, zone)} ${moonName}, ${Math.round(illumination * 100)}% lit, ${moonUp}.`;
}

/** The engine's dark-window and Moon sentences, which formatDarkAndMoonSummary already covers. */
const DARK_OR_MOON_REASON = /^(Dark from \S+ to \S+ \(|Darkest from \S+ to \S+ \(|The \d+% Moon is up for )/;

export function reasonsBesideDarkAndMoon(reasons: readonly string[]): string[] {
  return reasons.filter((reason) => !DARK_OR_MOON_REASON.test(reason));
}

export function describeWeatherStatus(status: ForecastStatus): string {
  switch (status) {
    case "disabled":
      return "Cloud forecast is off. Cloud cover is unknown; rankings and the verdict ignore clouds.";
    case "loading":
      return "Checking the Open-Meteo cloud forecast.";
    case "ok":
      return "Open-Meteo cloud forecast in use.";
    case "partial":
      return "Cloud forecast covers part of the night.";
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
        suggestion: "Try a date nearer the winter solstice, or choose a location closer to the equator.",
      };
    case "white-night":
      return {
        title: "White night: the Sun sets briefly but stays in civil twilight above -6°.",
        suggestion: "Try a date nearer the winter solstice, or choose a location closer to the equator.",
      };
    case "no-nautical-darkness":
      return {
        title: "Bright twilight persists: the Sun never drops below -12° tonight.",
        suggestion:
          "Bright planets and stars are still visible, or try a date further from the summer solstice for deep-sky viewing.",
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
