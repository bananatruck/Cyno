import type { CloudSample } from "./types";
export const HOUR = 3600000;
export const DAY = 24 * HOUR;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Calendar YYYY-MM-DD to noon UTC epoch ms; does not use ISO string parsing. */
export function utcNoonFromYmd(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day, 12, 0, 0, 0);
}

export function parseYmd(date: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year + month + day)) return null;
  return { year, month, day };
}

/** True when the calendar day exists and round-trips through UTC noon. */
export function isRealCalendarDate(date: string, minYear = 1800, maxYear = 2200): boolean {
  const parts = parseYmd(date);
  if (!parts) return false;
  if (parts.year < minYear || parts.year > maxYear) return false;
  const ms = utcNoonFromYmd(parts.year, parts.month, parts.day);
  const d = new Date(ms);
  return (
    d.getUTCFullYear() === parts.year && d.getUTCMonth() + 1 === parts.month && d.getUTCDate() === parts.day
  );
}

export function addCalendarDays(date: string, days: number): string {
  const parts = parseYmd(date);
  if (!parts) throw new Error("bad date");
  const ms = utcNoonFromYmd(parts.year, parts.month, parts.day) + days * DAY;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

const wallClockParts = (time: number, timeZone: string) => {
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  return Object.fromEntries(format.formatToParts(time).map((p) => [p.type, p.value])) as Record<
    string,
    string
  >;
};

export function localNoon(date: string, timeZone: string): number {
  const parts = parseYmd(date);
  if (!parts) throw new Error("bad date");
  let time = utcNoonFromYmd(parts.year, parts.month, parts.day);
  for (let i = 0; i < 4; i++) {
    const p = wallClockParts(time, timeZone);
    const y = Number(p.year);
    const mo = Number(p.month);
    const d = Number(p.day);
    const h = Number(p.hour);
    const min = Number(p.minute);
    const sec = Number(p.second);
    const wall = Date.UTC(y, mo - 1, d, h, min, sec);
    time += utcNoonFromYmd(parts.year, parts.month, parts.day) - wall;
  }
  return time;
}

/** Local civil date and 12:00 wall time at `time` in `timeZone`, as YYYY-MM-DD. */
export function formatLocalDateAtNoon(time: number, timeZone: string): string {
  const p = wallClockParts(time, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

export function localNoonExists(date: string, timeZone: string): boolean {
  try {
    const noon = localNoon(date, timeZone);
    const p = wallClockParts(noon, timeZone);
    return `${p.year}-${p.month}-${p.day}` === date && p.hour === "12" && p.minute === "00";
  } catch {
    return false;
  }
}

export function nightWindow(date: string, zone: string) {
  const next = addCalendarDays(date, 1);
  return {
    start: new Date(localNoon(date, zone)).toISOString(),
    end: new Date(localNoon(next, zone)).toISOString(),
  };
}

export type ParsedCloudCover = { times: number[]; percents: number[] };

export function parseCloudCover(samples: CloudSample[] | null): ParsedCloudCover | null {
  if (!samples?.length) return null;
  return { times: samples.map((s) => Date.parse(s.time)), percents: samples.map((s) => s.percent) };
}

function latestCloudIndex(time: number, times: number[]): number {
  let lo = 0;
  let hi = times.length - 1;
  let idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = times[mid];
    if (t === undefined) break;
    if (t <= time) {
      idx = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return idx;
}

export function cloudAtParsed(time: number, parsed: ParsedCloudCover | null): number | null {
  if (!parsed) return null;
  const idx = latestCloudIndex(time, parsed.times);
  if (idx < 0) return null;
  const sampleTime = parsed.times[idx];
  const percent = parsed.percents[idx];
  if (sampleTime === undefined || percent === undefined) return null;
  return time - sampleTime < HOUR ? percent : null;
}

export function cloudAt(time: number, samples: CloudSample[] | null): number | null {
  return cloudAtParsed(time, parseCloudCover(samples));
}

export function clockFormatter(timeZone: string): (time: string) => string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return (time) => fmt.format(new Date(Math.round(Date.parse(time) / 60000) * 60000));
}
