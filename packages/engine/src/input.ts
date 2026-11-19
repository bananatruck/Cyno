import tzLookup from "@photostructure/tz-lookup";
import type { CloudSample, InputError, ParseResult, PlanInput, ResolvedInput } from "./types";
import { isRealCalendarDate } from "./time";

export class PlanInputError extends Error {
  constructor(public errors: InputError[]) {
    super(errors.map((e) => `${e.field}: ${e.message}`).join(" "));
    this.name = "PlanInputError";
  }
}
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const DATE_RANGE_MESSAGE = "Enter a date between 1800-01-01 and 2200-12-31.";

function isOffsetTimeZone(tz: string): boolean {
  return /^[+-]\d/.test(tz);
}

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
  const latitude = r.latitude;
  const longitude = r.longitude;
  const date = r.date;
  const timeZone = r.timeZone;
  const elevationMeters = r.elevationMeters;
  const equipment = r.equipment;
  const sky = r.sky;
  const stepMinutes = r.stepMinutes;
  const cloudCoverRaw = r.cloudCover;

  const errors: InputError[] = [];
  const error = (field: InputError["field"], message: string) => errors.push({ field, message });
  if (!finite(latitude) || Math.abs(latitude) > 90)
    error("latitude", "Latitude must be between -90° and 90°.");
  if (!finite(longitude) || Math.abs(longitude) > 180)
    error("longitude", "Longitude must be between -180° and 180°.");
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !isRealCalendarDate(date))
    error("date", DATE_RANGE_MESSAGE);
  if (timeZone !== undefined) {
    try {
      if (typeof timeZone !== "string" || !timeZone) throw new Error();
      if (timeZone !== "UTC" && isOffsetTimeZone(timeZone)) throw new Error();
      new Intl.DateTimeFormat("en", { timeZone }).format(0);
    } catch {
      error(
        "timeZone",
        typeof timeZone === "string" && isOffsetTimeZone(timeZone)
          ? "Use a named IANA time zone or UTC, not a numeric UTC offset."
          : "Enter a known IANA time zone.",
      );
    }
  }
  // Ground observers only: astronomy-engine's rise and set refraction fails above about 43 km, and
  // 10 km is already above the highest mountain.
  if (
    elevationMeters !== undefined &&
    (!finite(elevationMeters) || elevationMeters < -500 || elevationMeters > 10000)
  )
    error("elevationMeters", "Elevation must be between -500 and 10000 metres.");
  if (
    equipment !== undefined &&
    equipment !== "eye" &&
    equipment !== "binoculars" &&
    equipment !== "telescope"
  )
    error("equipment", "Choose eye, binoculars or telescope.");
  if (sky !== undefined && sky !== "city" && sky !== "suburban" && sky !== "rural" && sky !== "dark")
    error("sky", "Choose city, suburban, rural or dark sky.");
  if (stepMinutes !== undefined && (!finite(stepMinutes) || stepMinutes < 1 || stepMinutes > 60))
    error("stepMinutes", "The sampling step must be between 1 and 60 minutes.");
  const clouds: CloudSample[] = [];
  if (cloudCoverRaw !== undefined) {
    if (!Array.isArray(cloudCoverRaw))
      error("cloudCover", "Cloud cover must be a list of timed percentages.");
    else
      for (const sample of cloudCoverRaw) {
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
  const value: PlanInput = {
    latitude: latitude as number,
    longitude: longitude as number,
    date: date as string,
  };
  if (timeZone !== undefined) value.timeZone = timeZone as string;
  if (elevationMeters !== undefined) value.elevationMeters = elevationMeters as number;
  if (equipment !== undefined) value.equipment = equipment as PlanInput["equipment"];
  if (sky !== undefined) value.sky = sky as PlanInput["sky"];
  if (stepMinutes !== undefined) value.stepMinutes = stepMinutes as number;
  if (cloudCoverRaw !== undefined) value.cloudCover = clouds;
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
