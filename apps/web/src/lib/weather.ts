import type { CloudSample } from "@cyno/engine";

export type WeatherStatus = "ok" | "offline" | "unavailable" | "out-of-range";

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

export function isDateInForecastWindow(dateStr: string, now: Date = new Date()): boolean {
  const targetMs = Date.parse(`${dateStr}T12:00:00Z`);
  if (!Number.isFinite(targetMs)) return false;
  const todayUtcStr = now.toISOString().slice(0, 10);
  const todayMs = Date.parse(`${todayUtcStr}T12:00:00Z`);
  const diffDays = (targetMs - todayMs) / DAY_MS;
  // Open-Meteo forecasts cover today (allowing -1 day for timezone differences) through +15 days (16 days total).
  return diffDays >= -1 && diffDays <= 15;
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
    const utcStr = rawTime.endsWith("Z")
      ? rawTime
      : `${rawTime}:00.000Z`.replace(/:00:00\.000Z$/, ":00.000Z");
    const parsedMs = Date.parse(rawTime.endsWith("Z") ? rawTime : `${rawTime}Z`);
    if (!Number.isFinite(parsedMs)) continue;
    samples.push({
      time: new Date(parsedMs).toISOString(),
      percent,
    });
    void utcStr;
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

  const endDate = addOneDay(date);
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
