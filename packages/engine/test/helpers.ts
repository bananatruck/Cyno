import { readFileSync } from "node:fs";
export function raw(name: string): string {
  return readFileSync(new URL(`./fixtures/raw/${name}`, import.meta.url), "utf8");
}
interface CivilDate {
  year: number;
  month: number;
  day: number;
}
export function civilDate(row: CivilDate): string {
  return `${row.year}-${String(row.month).padStart(2, "0")}-${String(row.day).padStart(2, "0")}`;
}
export function utc(row: CivilDate, time: string, offset = 0): number {
  return Date.parse(`${civilDate(row)}T${time}:00Z`) - offset * 3600000;
}
export function usno(name: string) {
  return (
    JSON.parse(raw(name)) as {
      properties: {
        data: CivilDate & {
          tz: number;
          fracillum: string;
          curphase?: string;
          sundata: { phen: string; time: string | null }[];
          moondata: { phen: string; time: string | null }[];
        };
      };
    }
  ).properties.data;
}
export function phases() {
  return JSON.parse(raw("usno_phases_2026.json")) as {
    numphases: number;
    phasedata: (CivilDate & { phase: string; time: string })[];
  };
}
export function horizons(name: string) {
  const text = raw(name);
  const rows = text.split("$$SOE")[1]?.split("$$EOE")[0];
  if (!rows) throw new Error(`Missing Horizons rows in ${name}.`);
  return rows
    .trim()
    .split("\n")
    .map((line) => {
      const match =
        /^\s*(\d{4}-[A-Za-z]{3}-\d{2}) (\d{2}:\d{2})\s+[*A-Za-z ]*?\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/.exec(
          line,
        );
      if (!match) throw new Error(`Invalid Horizons row: ${line}`);
      const [, date, time, az, alt, apMag] = match;
      return {
        time: new Date(`${date} ${time}:00 UTC`).toISOString(),
        azDeg: Number(az),
        altDeg: Number(alt),
        apMag: Number(apMag),
      };
    });
}
export function required<T>(value: T | undefined | null): T {
  if (value === null || value === undefined) throw new Error("Required test data is missing.");
  return value;
}
