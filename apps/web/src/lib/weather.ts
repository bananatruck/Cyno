import type { CloudSample } from "@cyno/engine";

export type WeatherStatus = "ok" | "offline" | "unavailable" | "out-of-range" | "disabled";

/** What the shown plan makes of the forecast: "partial" when it covers only some of the dark hours. */
export type ForecastStatus = WeatherStatus | "loading" | "partial";

export interface WeatherResult {
  samples: CloudSample[];
  status: WeatherStatus;
}

const DAY_MS = 86_400_000;
const TIMEOUT_MS = 6_000;

export function addOneDay(dateStr: string): string {
  const ms = Date.parse(`${dateStr}T12:00:00Z`);
  if (!Number.isFinite(ms)) return dateStr;
  return new Date(ms + DAY_MS).toISOString().slice(0, 10);
}

/**
 * Open-Meteo's forecast starts at 0:00 today and returns at most 16 days (forecast_days 0 to 16,
 * https://open-meteo.com/en/docs), so the last day it serves is today + 15 in the requested time zone
 * (GMT here); an end_date after it is rejected with HTTP 400.
 */
const LAST_SERVED_DAY = 15;

export function isDateInForecastWindow(dateStr: string, now: Date = new Date()): boolean {
  const targetMs = Date.parse(`${dateStr}T12:00:00Z`);
  if (!Number.isFinite(targetMs)) return false;
  const todayUtcStr = now.toISOString().slice(0, 10);
  const todayMs = Date.parse(`${todayUtcStr}T12:00:00Z`);
  const diffDays = (targetMs - todayMs) / DAY_MS;
  // Today (allowing -1 day for time zone differences) through the last served day.
  return diffDays >= -1 && diffDays <= LAST_SERVED_DAY;
}

/** The last day Open-Meteo serves a forecast for, as yyyy-mm-dd in GMT. */
function lastServedDay(now: Date): string {
  const todayMs = Date.parse(`${now.toISOString().slice(0, 10)}T12:00:00Z`);
  return new Date(todayMs + LAST_SERVED_DAY * DAY_MS).toISOString().slice(0, 10);
}

export function mapOpenMeteoToCloudSamples(body: unknown): CloudSample[] {
  if (typeof body !== "object" || body === null) return [];
  const hourly = (body as { hourly?: unknown }).hourly;
  if (typeof hourly !== "object" || hourly === null) return [];
  const times = (hourly as { time?: unknown }).time;
  const clouds = (hourly as { cloud_cover?: unknown }).cloud_cover;
  if (!Array.isArray(times) || !Array.isArray(clouds)) return [];

  const length = Math.min(times.length, clouds.length);
  const samples: CloudSample[] = [];
  for (let i = 0; i < length; i++) {
    const rawTime = times[i];
    const rawCloud = clouds[i];
    if (typeof rawTime !== "string" || typeof rawCloud !== "number" || !Number.isFinite(rawCloud)) {
      continue;
    }
    const percent = Math.max(0, Math.min(100, rawCloud));
    const parsedMs = Date.parse(rawTime.endsWith("Z") ? rawTime : `${rawTime}Z`);
    if (!Number.isFinite(parsedMs)) continue;
    samples.push({
      time: new Date(parsedMs).toISOString(),
      percent,
    });
  }
  return samples;
}

export interface FetchWeatherOptions {
  signal?: AbortSignal;
  now?: Date;
  fetchImpl?: typeof fetch;
}

export async function fetchCloudForecast(
  latitude: number,
  longitude: number,
  date: string,
  options: FetchWeatherOptions = {},
): Promise<WeatherResult> {
  if (!isDateInForecastWindow(date, options.now)) {
    return { samples: [], status: "out-of-range" };
  }

  // The night runs into the next morning, so ask for the following day too, but never past the last
  // served day: for the last accepted date the forecast then covers only its evening.
  const nextDay = addOneDay(date);
  const lastDay = lastServedDay(options.now ?? new Date());
  const endDate = nextDay > lastDay ? lastDay : nextDay;
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: "cloud_cover",
    timezone: "GMT",
    start_date: date,
    end_date: endDate,
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;

  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onExternalAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const fetchFn = options.fetchImpl ?? globalThis.fetch;
    const response = await fetchFn(url, { signal: controller.signal });
    if (!response.ok) {
      return { samples: [], status: "unavailable" };
    }
    const data: unknown = await response.json();
    const samples = mapOpenMeteoToCloudSamples(data);
    if (samples.length === 0) {
      return { samples: [], status: "unavailable" };
    }
    return { samples, status: "ok" };
  } catch {
    return { samples: [], status: "offline" };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onExternalAbort);
  }
}
