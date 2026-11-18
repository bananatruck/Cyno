import { describe, expect, it } from "vitest";
import { Body, Illumination, MakeTime, MoonPhase, Observer, SearchRiseSet } from "astronomy-engine";
import { catalog, planNight } from "../src/index";
import { moonPhaseName } from "../src/moonPhase";
import { HOUR } from "../src/time";
import { civilDate, phases, required, utc } from "./helpers";
import { bodyPosition } from "../src/positions";

const lb = {
  latitude: 33.77,
  longitude: -118.19,
  date: "2026-11-17",
  timeZone: "America/Los_Angeles",
};

function hourlyCloudSamples(fromIso: string, toIso: string, percent = 100) {
  const samples = [];
  for (let t = Date.parse(fromIso); t <= Date.parse(toIso); t += HOUR) {
    samples.push({ time: new Date(t).toISOString(), percent });
  }
  return samples;
}

function azimuthFromNorth(azDeg: number): number {
  return Math.min(azDeg, 360 - azDeg);
}

function moonUpOverlapFromPlan(plan: ReturnType<typeof planNight>): number {
  const dark = plan.darkWindow;
  if (!dark) return 0;
  const a = Date.parse(dark.start);
  const b = Date.parse(dark.end);
  const moonTimes = plan.events
    .filter((e) => e.kind === "moonrise" || e.kind === "moonset")
    .map((e) => ({ kind: e.kind, t: Date.parse(e.time) }))
    .sort((x, y) => x.t - y.t);
  let up = false;
  for (const e of moonTimes) {
    if (e.t <= a) up = e.kind === "moonrise";
  }
  if (moonTimes.length === 0) {
    const observer = new Observer(plan.input.latitude, plan.input.longitude, plan.input.elevationMeters);
    const rise = SearchRiseSet(Body.Moon, observer, 1, new Date(a), -2);
    const set = SearchRiseSet(Body.Moon, observer, -1, new Date(a), -2);
    const riseT = rise?.date.getTime() ?? 0;
    const setT = set?.date.getTime() ?? 0;
    up = riseT > setT;
  }
  let hours = 0;
  let cursor = a;
  let state = up;
  for (const e of moonTimes.filter((e) => e.t > a && e.t < b)) {
    if (state) hours += (e.t - cursor) / HOUR;
    state = e.kind === "moonrise";
    cursor = e.t;
  }
  if (state) hours += (b - cursor) / HOUR;
  return hours;
}

describe("meanCloud partial forecast coverage", () => {
  const cloudCover = hourlyCloudSamples("2026-11-18T02:00:00.000Z", "2026-11-18T14:00:00.000Z");
  const withoutEight = cloudCover.filter((c) => c.time !== "2026-11-18T08:00:00.000Z");

  it("tolerates one missing hourly sample without inflating the verdict score", () => {
    const full = planNight({ ...lb, cloudCover });
    const gap = planNight({ ...lb, cloudCover: withoutEight });
    const unknown = planNight({ ...lb });
    expect(Math.abs(full.verdict.score - gap.verdict.score)).toBeLessThanOrEqual(1);
    expect(gap.verdict.score).toBeLessThan(unknown.verdict.score);
  });
});

describe("astronomy-engine cross-checks", () => {
  const fixture = phases();
  for (const row of fixture.phasedata) {
    it(`moonPhaseName matches USNO for ${civilDate(row)} ${row.phase}`, () => {
      const time = MakeTime(new Date(utc(row, row.time)));
      const phase = MoonPhase(time);
      const illum = Illumination(Body.Moon, time);
      expect(moonPhaseName(phase, illum.phase_fraction)).toBe(row.phase);
    });
  }

  it("Polaris track stays near latitude and north through planNight", () => {
    const plan = planNight(lb);
    const polaris = catalog.find((c) => c.name === "Polaris");
    expect(polaris).toBeDefined();
    const ranked =
      plan.objects.find((o) => o.id === polaris!.id) ?? plan.hidden.find((o) => o.id === polaris!.id);
    expect(ranked && "track" in ranked).toBe(true);
    const track = (ranked as { track: { altDeg: number; azDeg: number }[] }).track;
    for (const point of track) {
      expect(Math.abs(point.altDeg - lb.latitude)).toBeLessThanOrEqual(1);
      expect(azimuthFromNorth(point.azDeg)).toBeLessThanOrEqual(2);
    }
  });
});

describe("moon hours in dark window", () => {
  it("matches overlap from moonrise and moonset events", () => {
    const plan = planNight(lb);
    const expected = moonUpOverlapFromPlan(plan);
    expect(Math.abs(plan.moon.hoursUpInDarkWindow - expected) * 60).toBeLessThanOrEqual(1);
  });
});

describe("moon hours when the Moon rose before the night window", () => {
  // Waxing crescent three days after the 2026-11-09 new Moon: it rises before local noon,
  // so no moonrise falls inside the noon-to-noon window, yet it is up at the start of the dark window.
  it("counts the Moon as up until its moonset", () => {
    const plan = planNight({
      latitude: 33.77,
      longitude: -118.19,
      date: "2026-11-12",
      timeZone: "America/Los_Angeles",
    });
    const dark = required(plan.darkWindow);
    const observer = new Observer(33.77, -118.19, 0);
    let minutesUp = 0;
    for (let t = Date.parse(dark.start); t < Date.parse(dark.end); t += 60_000) {
      // Moonrise and moonset in astronomy-engine put the Moon's centre about 0.8 degrees below the horizon.
      if (bodyPosition(Body.Moon, MakeTime(new Date(t)), observer).altDeg > -0.8) minutesUp++;
    }
    expect(minutesUp).toBeGreaterThan(0);
    expect(Math.abs(plan.moon.hoursUpInDarkWindow * 60 - minutesUp)).toBeLessThanOrEqual(5);
  });
});
