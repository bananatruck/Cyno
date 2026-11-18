import tzLookup from "@photostructure/tz-lookup";
import type { CloudSample, InputError, ParseResult, PlanInput, ResolvedInput } from "./types";

export class PlanInputError extends Error {
  constructor(public errors: InputError[]) {
    super(errors.map((e) => `${e.field}: ${e.message}`).join(" "));
    this.name = "PlanInputError";
  }
}
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export function resolveTimeZone(lat: number, lon: number): string {
  const errors: InputError[] = [];
  if (!finite(lat) || Math.abs(lat) > 90)
    errors.push({ field: "latitude", message: "Latitude must be between -90° and 90°." });
  if (!finite(lon) || Math.abs(lon) > 180)
    errors.push({ field: "longitude", message: "Longitude must be between -180° and 180°." });
  if (errors.length) throw new PlanInputError(errors);
  return tzLookup(lat, lon);
}
export function parsePlanInput(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return { ok: false, errors: [{ field: "input", message: "Enter a plan input object." }] };
  const r = raw as Record<string, unknown>;
  const errors: InputError[] = [];
  const error = (field: InputError["field"], message: string) => errors.push({ field, message });
  if (!finite(r.latitude) || Math.abs(r.latitude) > 90)
    error("latitude", "Latitude must be between -90° and 90°.");
  if (!finite(r.longitude) || Math.abs(r.longitude) > 180)
    error("longitude", "Longitude must be between -180° and 180°.");
  if (
    typeof r.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
    !Number.isFinite(Date.parse(`${r.date}T12:00:00Z`)) ||
    new Date(`${r.date}T12:00:00Z`).toISOString().slice(0, 10) !== r.date
  )
    error("date", "Enter a real date as YYYY-MM-DD.");
  if (r.timeZone !== undefined) {
    try {
      if (typeof r.timeZone !== "string" || !r.timeZone) throw new Error();
      new Intl.DateTimeFormat("en", { timeZone: r.timeZone }).format(0);
    } catch {
      error("timeZone", "Enter a known IANA time zone.");
    }
  }
  // Ground observers only: astronomy-engine's rise and set refraction fails above about 43 km, and
  // 10 km is already above the highest mountain.
  if (
    r.elevationMeters !== undefined &&
    (!finite(r.elevationMeters) || r.elevationMeters < -500 || r.elevationMeters > 10000)
  )
    error("elevationMeters", "Elevation must be between -500 and 10000 metres.");
  if (
    r.equipment !== undefined &&
    r.equipment !== "eye" &&
    r.equipment !== "binoculars" &&
    r.equipment !== "telescope"
  )
    error("equipment", "Choose eye, binoculars or telescope.");
  if (
    r.sky !== undefined &&
    r.sky !== "city" &&
    r.sky !== "suburban" &&
    r.sky !== "rural" &&
    r.sky !== "dark"
  )
    error("sky", "Choose city, suburban, rural or dark sky.");
  if (r.stepMinutes !== undefined && (!finite(r.stepMinutes) || r.stepMinutes < 1 || r.stepMinutes > 60))
    error("stepMinutes", "The sampling step must be between 1 and 60 minutes.");
  const clouds: CloudSample[] = [];
  if (r.cloudCover !== undefined) {
    if (!Array.isArray(r.cloudCover)) error("cloudCover", "Cloud cover must be a list of timed percentages.");
    else
      for (const sample of r.cloudCover) {
        if (
          typeof sample !== "object" ||
          sample === null ||
          !("time" in sample) ||
          typeof sample.time !== "string" ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z$/.test(sample.time) ||
          !Number.isFinite(Date.parse(sample.time)) ||
          new Date(sample.time).toISOString().slice(0, 10) !== sample.time.slice(0, 10) ||
          Number(sample.time.slice(11, 13)) > 23 ||
          Number(sample.time.slice(14, 16)) > 59 ||
          !("percent" in sample) ||
          !finite(sample.percent) ||
          sample.percent < 0 ||
          sample.percent > 100
        )
          error("cloudCover", "Each cloud sample needs a UTC time and a percentage from 0 to 100.");
        else clouds.push({ time: sample.time, percent: sample.percent });
      }
  }
  if (errors.length) return { ok: false, errors };
  // Every public field has been checked above. Discard unknown properties.
  const value = Object.fromEntries(
    Object.entries(r).filter(([key]) =>
      [
        "latitude",
        "longitude",
        "date",
        "timeZone",
        "elevationMeters",
        "equipment",
        "sky",
        "stepMinutes",
      ].includes(key),
    ),
  ) as unknown as PlanInput;
  if (r.cloudCover !== undefined) value.cloudCover = clouds;
  return { ok: true, value };
}
export function resolveInput(raw: unknown): ResolvedInput {
  const result = parsePlanInput(raw);
  if (!result.ok) throw new PlanInputError(result.errors);
  const v = result.value;
  return {
    ...v,
    timeZone: v.timeZone ?? resolveTimeZone(v.latitude, v.longitude),
    elevationMeters: v.elevationMeters ?? 0,
    equipment: v.equipment ?? "eye",
    sky: v.sky ?? "suburban",
    stepMinutes: v.stepMinutes ?? 10,
    cloudCover: v.cloudCover?.slice().sort((a, b) => Date.parse(a.time) - Date.parse(b.time)) ?? null,
  };
}
