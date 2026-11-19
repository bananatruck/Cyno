import type { Equipment, SkyQuality } from "@cyno/engine";
import { DEFAULT_PLACE, findMatchingPreset, todayInPlaceTimeZone } from "./places";

const PLAIN_DECIMAL = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

/**
 * Reads a latitude or longitude typed by the user or taken from the URL.
 * Only plain decimals count: `Number` alone would accept "0x21" or "1e1", which a number input
 * shows differently (or not at all), so the box and the computed plan would disagree.
 */
export function parseCoordinateText(text: string): number {
  const trimmed = text.trim();
  return PLAIN_DECIMAL.test(trimmed) ? Number(trimmed) : Number.NaN;
}

/**
 * Rewrites an accepted coordinate ("+45", "5.", ".5") in the spelling a number input can show ("45", "5",
 * "0.5"), keeping its digits so the value is unchanged. Rejected text is returned as given, so its field
 * error still shows.
 */
function normalizeCoordinateText(text: string): string {
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(text.trim());
  if (!match || Number.isNaN(parseCoordinateText(text))) return text;
  const [, sign, whole, fraction] = match;
  return `${sign === "-" ? "-" : ""}${whole || "0"}${fraction ? `.${fraction}` : ""}`;
}

export function coordinatePlaceName(latitude: number, longitude: number): string {
  return findMatchingPreset(latitude, longitude)?.name ?? `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`;
}

export interface UrlState {
  latText: string;
  lonText: string;
  date: string;
  sky: SkyQuality;
  equipment: Equipment;
  placeName: string;
}

export function readUrlState(search: string, now: Date = new Date()): UrlState {
  const params = new URLSearchParams(search);
  const rawLat = params.get("lat");
  const rawLon = params.get("lon");
  const latText = normalizeCoordinateText(rawLat ?? String(DEFAULT_PLACE.latitude));
  const lonText = normalizeCoordinateText(rawLon ?? String(DEFAULT_PLACE.longitude));
  const latNum = parseCoordinateText(latText);
  const lonNum = parseCoordinateText(lonText);
  const validCoordinates = Number.isFinite(latNum) && Number.isFinite(lonNum);

  const date =
    params.get("date") ||
    todayInPlaceTimeZone(
      validCoordinates ? latNum : DEFAULT_PLACE.latitude,
      validCoordinates ? lonNum : DEFAULT_PLACE.longitude,
      now,
    );

  const rawSky = params.get("sky");
  const sky: SkyQuality =
    rawSky === "city" || rawSky === "suburban" || rawSky === "rural" || rawSky === "dark"
      ? rawSky
      : "suburban";

  const rawEq = params.get("eq");
  const equipment: Equipment =
    rawEq === "eye" || rawEq === "binoculars" || rawEq === "telescope" ? rawEq : "eye";

  const placeName =
    params.get("name")?.trim() ||
    (validCoordinates ? coordinatePlaceName(latNum, lonNum) : DEFAULT_PLACE.name);

  return { latText, lonText, date, sky, equipment, placeName };
}
