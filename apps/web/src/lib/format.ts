import type { NightCondition, ObjectKind } from "@cyno/engine";

export function formatTimeHHMM(isoString: string, timeZone: string): string {
  const ms = Date.parse(isoString);
  if (!Number.isFinite(ms)) return "--:--";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(ms));
  } catch {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(ms));
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
