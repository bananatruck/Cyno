import { Body, Illumination, MakeTime, MoonPhase, SearchAltitude, SearchRiseSet } from "astronomy-engine";
import type { Observer } from "astronomy-engine";
import type { DarkWindow, Darkness, MoonInfo, NightCondition, SkyEvent, SkyEventKind } from "./types";
import { bodyPosition } from "./positions";
import { DAY, HOUR } from "./time";
export function darkness(alt: number): Darkness {
  return alt >= -0.833
    ? "day"
    : alt >= -6
      ? "civil-twilight"
      : alt >= -12
        ? "nautical-twilight"
        : alt >= -18
          ? "astronomical-twilight"
          : "night";
}
export function altitudeCrossings(
  body: Body,
  observer: Observer,
  start: number,
  end: number,
  altitude: number,
): number[] {
  const result: number[] = [];
  for (const direction of [-1, 1]) {
    let cursor = start;
    while (cursor < end) {
      const found = SearchAltitude(
        body,
        observer,
        direction,
        new Date(cursor),
        (end - cursor) / DAY,
        altitude,
      );
      if (!found || found.date.getTime() >= end) break;
      result.push(found.date.getTime());
      cursor = found.date.getTime() + 1000;
    }
  }
  return result.sort((a, b) => a - b);
}
export function skyEvents(observer: Observer, start: number, end: number): SkyEvent[] {
  const events: SkyEvent[] = [];
  const add = (kind: SkyEventKind, time: number) => events.push({ kind, time: new Date(time).toISOString() });
  for (const [body, rise, set] of [
    [Body.Sun, "sunrise", "sunset"],
    [Body.Moon, "moonrise", "moonset"],
  ] as const) {
    for (const direction of [-1, 1]) {
      let cursor = start;
      while (cursor < end) {
        const found = SearchRiseSet(body, observer, direction, new Date(cursor), (end - cursor) / DAY);
        if (!found || found.date.getTime() >= end) break;
        add(direction > 0 ? rise : set, found.date.getTime());
        cursor = found.date.getTime() + 1000;
      }
    }
  }
  for (const [alt, dawn, dusk] of [
    [-6, "civil-dawn", "civil-dusk"],
    [-12, "nautical-dawn", "nautical-dusk"],
    [-18, "astronomical-dawn", "astronomical-dusk"],
  ] as const) {
    for (const time of altitudeCrossings(Body.Sun, observer, start, end, alt)) {
      const rising = bodyPosition(Body.Sun, MakeTime(new Date(time + 1000)), observer).altDeg > alt;
      add(rising ? dawn : dusk, time);
    }
  }
  return events.sort((a, b) => a.time.localeCompare(b.time));
}
export function nightDarkness(
  observer: Observer,
  start: number,
  end: number,
  events: SkyEvent[],
): { condition: NightCondition; darkWindow: DarkWindow | null } {
  const edges = [
    start,
    ...events
      .filter((e) => e.kind.includes("dawn") || e.kind.includes("dusk"))
      .map((e) => Date.parse(e.time)),
    ...altitudeCrossings(Body.Sun, observer, start, end, -0.833),
    end,
  ].sort((a, b) => a - b);
  const levels: Darkness[] = ["day", "civil-twilight", "nautical-twilight", "astronomical-twilight", "night"];
  const segments: { start: number; end: number; level: Darkness }[] = [];
  for (let i = 1; i < edges.length; i++) {
    const a = edges[i - 1],
      b = edges[i];
    if (a === undefined || b === undefined || b <= a) continue;
    const level = darkness(bodyPosition(Body.Sun, MakeTime(new Date((a + b) / 2)), observer).altDeg);
    const last = segments.at(-1);
    if (last?.level === level) last.end = b;
    else segments.push({ start: a, end: b, level });
  }
  const darkest = Math.max(...segments.map((s) => levels.indexOf(s.level)));
  const hasDay = segments.some((s) => s.level === "day");
  const condition: NightCondition =
    darkest === 0
      ? "polar-day"
      : !hasDay
        ? "polar-night"
        : darkest === 4
          ? "normal"
          : darkest === 3
            ? "no-astronomical-darkness"
            : darkest === 2
              ? "no-nautical-darkness"
              : "white-night";
  const best = segments
    .filter((s) => levels.indexOf(s.level) === darkest)
    .sort((a, b) => b.end - b.start - (a.end - a.start))[0];
  if (!best || best.level === "day") return { condition, darkWindow: null };
  return {
    condition,
    darkWindow: {
      start: new Date(best.start).toISOString(),
      end: new Date(best.end).toISOString(),
      level: best.level,
      hours: (best.end - best.start) / HOUR,
    },
  };
}
export function moonInfo(observer: Observer, start: number, end: number, dark: DarkWindow | null): MoonInfo {
  const a = dark ? Date.parse(dark.start) : start,
    b = dark ? Date.parse(dark.end) : end;
  const time = MakeTime(new Date((a + b) / 2));
  const illumination = Illumination(Body.Moon, time);
  const phase = MoonPhase(time);
  const names = [
    "New Moon",
    "Waxing Crescent",
    "First Quarter",
    "Waxing Gibbous",
    "Full Moon",
    "Waning Gibbous",
    "Last Quarter",
    "Waning Crescent",
  ];
  let hoursUp = 0;
  if (dark) {
    const edges = [a, ...altitudeCrossings(Body.Moon, observer, a, b, 0), b];
    for (let i = 1; i < edges.length; i++) {
      const left = edges[i - 1],
        right = edges[i];
      if (
        left !== undefined &&
        right !== undefined &&
        bodyPosition(Body.Moon, MakeTime(new Date((left + right) / 2)), observer).altDeg > 0
      )
        hoursUp += (right - left) / HOUR;
    }
  }
  return {
    illumination: illumination.phase_fraction,
    phaseAngleDeg: illumination.phase_angle,
    phaseName: names[Math.round(phase / 45) % 8] ?? "New Moon",
    hoursUpInDarkWindow: hoursUp,
  };
}
