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
  const latText = rawLat ?? String(DEFAULT_PLACE.latitude);
  const lonText = rawLon ?? String(DEFAULT_PLACE.longitude);
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
