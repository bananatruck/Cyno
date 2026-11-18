import type { CloudSample } from "./types";
export const HOUR = 3600000;
export const DAY = 24 * HOUR;
export function localNoon(date: string, timeZone: string): number {
  const target = Date.parse(`${date}T12:00:00Z`);
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
  let time = target;
  for (let i = 0; i < 4; i++) {
    const p = Object.fromEntries(format.formatToParts(time).map((p) => [p.type, p.value]));
    const wall = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    time += target - wall;
  }
  return time;
}
export function nightWindow(date: string, zone: string) {
  const next = new Date(Date.parse(`${date}T12:00:00Z`) + DAY).toISOString().slice(0, 10);
  return {
    start: new Date(localNoon(date, zone)).toISOString(),
    end: new Date(localNoon(next, zone)).toISOString(),
  };
}
export function cloudAt(time: number, samples: CloudSample[] | null): number | null {
  let latest: CloudSample | undefined;
  for (const sample of samples ?? []) {
    if (Date.parse(sample.time) > time) break;
    latest = sample;
  }
  return latest && time - Date.parse(latest.time) < HOUR ? latest.percent : null;
}
export function clockFormatter(timeZone: string): (time: string) => string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return (time) => fmt.format(new Date(time));
}
