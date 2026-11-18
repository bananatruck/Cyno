import { resolveTimeZone } from "@cyno/engine/input";

export interface PlacePreset {
  name: string;
  latitude: number;
  longitude: number;
}

export const PLACE_PRESETS: readonly PlacePreset[] = [
  { name: "Long Beach, CA", latitude: 33.77, longitude: -118.19 },
  { name: "London", latitude: 51.51, longitude: -0.13 },
  { name: "Tokyo", latitude: 35.68, longitude: 139.69 },
  { name: "Sydney", latitude: -33.87, longitude: 151.21 },
  { name: "Cape Town", latitude: -33.92, longitude: 18.42 },
  { name: "Reykjavik", latitude: 64.15, longitude: -21.94 },
  { name: "Tromso", latitude: 69.65, longitude: 18.96 },
  { name: "Mauna Kea", latitude: 19.82, longitude: -155.47 },
] as const;

export const DEFAULT_PLACE: PlacePreset = PLACE_PRESETS[0]!;

export function todayInPlaceTimeZone(latitude: number, longitude: number, now: Date = new Date()): string {
  let timeZone = "America/Los_Angeles";
  try {
    timeZone = resolveTimeZone(latitude, longitude);
  } catch {
    // Fall back to default zone when coordinates are out of range.
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "11";
  const day = parts.find((p) => p.type === "day")?.value ?? "17";
  return `${year}-${month}-${day}`;
}

export function findMatchingPreset(latitude: number, longitude: number): PlacePreset | undefined {
  return PLACE_PRESETS.find(
    (p) => Math.abs(p.latitude - latitude) < 0.005 && Math.abs(p.longitude - longitude) < 0.005,
  );
}
