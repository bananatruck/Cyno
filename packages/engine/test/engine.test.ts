import { expect, it } from "vitest";
import { Body, Illumination, MakeTime, Observer, Rotation_EQJ_HOR } from "astronomy-engine";
import { catalog, planNight } from "../src/index";
import { effectiveMagnitude, limitingMagnitude } from "../src/brightness";
import { bodyPosition, catalogPosition, separation } from "../src/positions";
import { cloudAt, clockFormatter, DAY, HOUR, localNoon, nightWindow } from "../src/time";
import { darkness } from "../src/sky";
import type { PlanInput } from "../src/types";
import { required } from "./helpers";
const input = { latitude: 33.77, longitude: -118.19, date: "2026-11-17", timeZone: "America/Los_Angeles" };
const plan = planNight(input);
const observer = new Observer(input.latitude, input.longitude, 0);
const clamp = (n: number) => Math.max(0, Math.min(1, n));
it("accounts for every object once and never includes the Sun", () => {
  const all = [...plan.objects, ...plan.hidden];
  const ids = [
    ...catalog.map((c) => c.id),
    ...Object.values(Body)
      .filter((b) =>
        ["Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"].includes(b),
      )
      .map((b) => b.toLowerCase()),
  ];
  expect(all.map((o) => o.id).sort()).toEqual(ids.sort());
  expect(new Set(all.map((o) => o.id)).size).toBe(all.length);
  expect(plan.hidden.every((o) => o.reason.length > 0)).toBe(true);
});
it("rotates the north celestial pole to the latitude", () => {
  // Polaris is absent from the supplied catalog. No Polaris coordinates are invented.
  for (const s of plan.timeline) {
    const time = MakeTime(new Date(s.time));
    const pole = catalogPosition({ raDeg: 0, decDeg: 90 }, time, Rotation_EQJ_HOR(time, observer));
    expect(Math.abs(pole.altDeg - input.latitude)).toBeLessThanOrEqual(1);
  }
});
it("returns complete airless tracks and a valid best visible sample", () => {
  for (const object of plan.objects) {
    expect(object.track.map((p) => p.time)).toEqual(plan.timeline.map((s) => s.time));
    expect(
      object.track.every(
        (p) =>
          Number.isFinite(p.altDeg) && p.altDeg >= -90 && p.altDeg <= 90 && p.azDeg >= 0 && p.azDeg < 360,
      ),
    ).toBe(true);
    const sample = required(plan.timeline.find((s) => s.time === object.best.time));
    expect(sample.sunAltDeg).toBeLessThan(-0.833);
    expect(object.best.altDeg).toBeGreaterThanOrEqual(10);
    expect(object.best.marginMag).toBeGreaterThanOrEqual(0);
    expect(object.best.cloudPercent === null || object.best.cloudPercent < 80).toBe(true);
    expect(object.best.marginMag).toBe(object.best.limitingMag - object.best.effectiveMag);
    expect(object.summary).toContain(clockFormatter(input.timeZone)(object.best.time));
  }
});
it("sums the six factor points and sorts with the specified tie breakers", () => {
  expect(plan.objects.length).toBeGreaterThan(0);
  for (const [index, o] of plan.objects.entries()) {
    expect(o.factors.map((f) => f.key)).toEqual([
      "altitude",
      "brightness",
      "moon",
      "duration",
      "darkness",
      "clouds",
    ]);
    expect(o.score).toBe(Math.round(o.factors.reduce((s, f) => s + f.points, 0) * 10) / 10);
    expect(o.rank).toBe(index + 1);
    expect(o.score).toBeGreaterThanOrEqual(0);
    expect(o.score).toBeLessThanOrEqual(100);
    const previous = plan.objects[index - 1];
    if (previous)
      expect(
        previous.score > o.score ||
          (previous.score === o.score &&
            (previous.best.marginMag > o.best.marginMag ||
              (previous.best.marginMag === o.best.marginMag && previous.name.localeCompare(o.name) <= 0))),
      ).toBe(true);
  }
});
it("recomputes every ranking factor from a BestMoment and hoursVisible", () => {
  const o = required(plan.objects.find((o) => o.kind !== "moon" && o.moonSeparationDeg !== null));
  const best = o.best;
  const s = required(plan.timeline.find((s) => s.time === best.time));
  const illumination = Illumination(Body.Moon, new Date(best.time));
  const limitWithout = limitingMagnitude(
    plan.input.sky,
    plan.input.equipment,
    s.sunAltDeg,
    best.altDeg,
    s.moonAltDeg,
    illumination.phase_angle,
    required(o.moonSeparationDeg),
    false,
  );
  const brightness = 35 * clamp((limitWithout - best.effectiveMag) / 5);
  const points = [
    30 * clamp((best.altDeg - 10) / 50),
    brightness,
    35 * clamp(best.marginMag / 5) - brightness,
    20 * clamp(o.hoursVisible / 4),
    { day: 0, "civil-twilight": 2, "nautical-twilight": 5, "astronomical-twilight": 10, night: 15 }[
      best.darkness
    ],
  ];
  points.push((-points.reduce((a, b) => a + b, 0) * (best.cloudPercent ?? 0)) / 100);
  expect(o.factors.map((f) => f.points)).toEqual(points);
});
it("never charges the Moon for its own light", () => {
  const moon = required(plan.objects.find((o) => o.kind === "moon"));
  expect(moon.moonSeparationDeg).toBeNull();
  expect(required(moon.factors.find((f) => f.key === "moon")).points).toBe(0);
  const s = required(plan.timeline.find((s) => s.time === moon.best.time));
  const illumination = Illumination(Body.Moon, new Date(s.time));
  expect(moon.best.limitingMag).toBe(
    limitingMagnitude(
      plan.input.sky,
      plan.input.equipment,
      s.sunAltDeg,
      moon.best.altDeg,
      s.moonAltDeg,
      illumination.phase_angle,
      0,
      false,
    ),
  );
});
it("more moonlight never raises the limiting magnitude", () => {
  for (const s of plan.timeline.filter((s) => s.darkness !== "day")) {
    const phase = Illumination(Body.Moon, new Date(s.time)).phase_angle;
    const limit = (include: boolean, angle = phase) =>
      limitingMagnitude(
        plan.input.sky,
        plan.input.equipment,
        s.sunAltDeg,
        90,
        s.moonAltDeg,
        angle,
        90 - s.moonAltDeg,
        include,
      );
    expect(limit(true)).toBeLessThanOrEqual(limit(false));
    expect(limit(true, 0)).toBeLessThanOrEqual(limit(true));
  }
});
it("better equipment never removes an object", () => {
  let previous = new Set(plan.objects.map((o) => o.id));
  for (const equipment of ["binoculars", "telescope"] as const) {
    const next = new Set(planNight({ ...input, equipment }).objects.map((o) => o.id));
    expect([...previous].every((id) => next.has(id))).toBe(true);
    previous = next;
  }
});
it("keeps unknown forecast gaps and expires samples after one hour", () => {
  const time = required(plan.timeline.find((s) => s.darkness === "night")).time;
  const samples = [{ time, percent: 80 }];
  expect(cloudAt(Date.parse(time) - 1, samples)).toBeNull();
  expect(cloudAt(Date.parse(time), samples)).toBe(80);
  expect(cloudAt(Date.parse(time) + HOUR, samples)).toBeNull();
  expect(cloudAt(Date.parse(time) + HOUR - 1, samples)).toBe(80);
  const cloudy = planNight({ ...input, cloudCover: samples });
  expect(required(cloudy.timeline.find((s) => s.time === time)).cloudPercent).toBe(80);
  expect(cloudy.objects.every((o) => o.best.time !== time)).toBe(true);
  expect(plan.timeline.every((s) => s.cloudPercent === null)).toBe(true);
  expect(
    plan.objects.every((o) => required(o.factors.find((f) => f.key === "clouds")).value === "No forecast."),
  ).toBe(true);
});
function forecast(percent: number) {
  const start = Date.parse(plan.window.start),
    end = Date.parse(plan.window.end);
  return Array.from({ length: Math.ceil((end - start) / HOUR) }, (_, i) => ({
    time: new Date(start + i * HOUR).toISOString(),
    percent,
  }));
}
it("clouds block visibility at the threshold and preserve hidden reason priority", () => {
  const blocked = planNight({ ...input, cloudCover: forecast(80) });
  expect(blocked.objects).toEqual([]);
  for (const o of plan.objects)
    expect(required(blocked.hidden.find((h) => h.id === o.id)).reason).toContain("Clouds");
  for (const o of plan.hidden)
    expect(required(blocked.hidden.find((h) => h.id === o.id)).reason).toBe(o.reason);
});
it("applies the cloud penalty to the other five factors", () => {
  const cloud = 35;
  const partial = planNight({ ...input, cloudCover: forecast(cloud) });
  for (const o of partial.objects) {
    const factors = o.factors.filter((f) => f.key !== "clouds");
    expect(required(o.factors.find((f) => f.key === "clouds")).points).toBe(
      (-factors.reduce((s, f) => s + f.points, 0) * cloud) / 100,
    );
  }
});
it("recomputes the verdict with and without forecast", () => {
  for (const p of [plan, planNight({ ...input, cloudCover: forecast(35) })]) {
    const dark = required(p.darkWindow);
    const base =
      40 * clamp(dark.hours / 4) + 30 * (1 - (p.moon.illumination * p.moon.hoursUpInDarkWindow) / dark.hours);
    const score = p.input.cloudCover ? base + 30 * (1 - 35 / 100) : (base * 100) / 70;
    expect(p.verdict.score).toBe(score);
    expect(p.verdict.label).toBe(score >= 65 ? "go" : score >= 35 ? "marginal" : "no-go");
  }
});
it("uses the actual midpoint for MoonInfo and exact twilight edges for darkness", () => {
  const dark = required(plan.darkWindow);
  const midpoint = new Date((Date.parse(dark.start) + Date.parse(dark.end)) / 2);
  const illumination = Illumination(Body.Moon, midpoint);
  expect(plan.moon.illumination).toBe(illumination.phase_fraction);
  expect(plan.moon.phaseAngleDeg).toBe(illumination.phase_angle);
  expect(dark.start).toBe(required(plan.events.find((e) => e.kind === "astronomical-dusk")).time);
  expect(dark.end).toBe(required(plan.events.find((e) => e.kind === "astronomical-dawn")).time);
  expect(dark.hours).toBe((Date.parse(dark.end) - Date.parse(dark.start)) / HOUR);
  expect(plan.moon.hoursUpInDarkWindow).toBeGreaterThanOrEqual(0);
  expect(plan.moon.hoursUpInDarkWindow).toBeLessThanOrEqual(dark.hours);
});
it("handles nights without astronomical darkness", () => {
  // Find this regime among the spec's two locations without inventing a reference.
  let partial: ReturnType<typeof planNight> | undefined;
  for (let offset = 0; offset < 90 && !partial; offset++) {
    const date = new Date(Date.parse("2026-06-21T12:00:00Z") - offset * DAY).toISOString().slice(0, 10);
    const candidate = planNight({
      latitude: 69.65,
      longitude: 18.96,
      date,
      timeZone: "Europe/Oslo",
      stepMinutes: 60,
    });
    if (candidate.condition === "no-astronomical-darkness") partial = candidate;
  }
  expect(required(partial).darkWindow?.level).toBe("astronomical-twilight");
});
it("handles every twilight-only regime and white-night verdict", () => {
  const found = new Map<string, ReturnType<typeof planNight>>();
  for (let offset = 0; offset < 90 && found.size < 3; offset++) {
    const date = new Date(Date.parse("2026-06-21T12:00:00Z") - offset * DAY).toISOString().slice(0, 10);
    const p = planNight({
      latitude: 69.65,
      longitude: 18.96,
      date,
      timeZone: "Europe/Oslo",
      stepMinutes: 60,
    });
    if (["white-night", "no-nautical-darkness", "no-astronomical-darkness"].includes(p.condition))
      found.set(p.condition, p);
  }
  expect(found.size).toBe(3);
  expect(required(found.get("white-night")).verdict.label).toBe("no-go");
});
it("uses local noon across daylight saving changes", () => {
  const date = input.date;
  const window = nightWindow(date, input.timeZone);
  expect(clockFormatter(input.timeZone)(window.start)).toBe("12:00");
  expect(clockFormatter(input.timeZone)(window.end)).toBe("12:00");
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: input.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  let changes = 0;
  const yearStart = Date.parse(`${date.slice(0, 4)}-01-01T12:00:00Z`);
  for (let t = yearStart; new Date(t).getUTCFullYear() === new Date(yearStart).getUTCFullYear(); t += DAY) {
    const d = new Date(t).toISOString().slice(0, 10);
    const w = nightWindow(d, input.timeZone);
    const length = Date.parse(w.end) - Date.parse(w.start);
    if (length !== DAY) {
      changes++;
      expect(Math.abs(length - DAY)).toBe(HOUR);
      expect(formatter.format(new Date(w.start))).toBe(
        formatter.format(new Date(localNoon(d, input.timeZone))),
      );
      expect(clockFormatter(input.timeZone)(w.end)).toBe("12:00");
    }
  }
  expect(changes).toBeGreaterThan(0);
});
it("is deterministic, does not mutate input and uses plain local text", () => {
  const raw: PlanInput = { ...input, cloudCover: forecast(35).reverse() };
  const saved = structuredClone(raw);
  const first = planNight(raw);
  expect(raw).toEqual(saved);
  expect(planNight(raw)).toEqual(first);
  const text = [
    ...first.objects.flatMap((o) => [o.summary, ...o.factors.flatMap((f) => [f.value, f.detail])]),
    ...first.hidden.map((h) => h.reason),
    ...first.verdict.reasons,
  ];
  expect(text.every((t) => !t.includes(String.fromCharCode(0x2014)))).toBe(true);
});
it("matches darkness thresholds exactly", () => {
  for (const [alt, expected] of [
    [-0.833, "day"],
    [-6, "civil-twilight"],
    [-12, "nautical-twilight"],
    [-18, "astronomical-twilight"],
    [-90, "night"],
  ] as const)
    expect(darkness(alt)).toBe(expected);
});
it("finishes a default night within the generous runtime budget", () => {
  const start = performance.now();
  const result = planNight(input);
  const elapsed = performance.now() - start;
  console.info(
    `planNight runtime: ${elapsed.toFixed(1)} ms for ${result.objects.length + result.hidden.length} objects.`,
  );
  expect(elapsed).toBeLessThan(3000);
});
it("uses true angular separation for the Moon", () => {
  for (const o of plan.objects.filter((o) => o.kind !== "moon")) {
    const moon = bodyPosition(Body.Moon, MakeTime(new Date(o.best.time)), observer);
    expect(o.moonSeparationDeg).toBe(separation(o.best, moon));
  }
});

it("chooses the largest visible margin, then altitude and time", () => {
  const object = required(plan.objects.find((o) => o.kind === "star"));
  const row = required(catalog.find((c) => c.id === object.id));
  const candidates = object.track
    .flatMap((position, index) => {
      const sample = required(plan.timeline[index]);
      if (sample.sunAltDeg >= -0.833 || position.altDeg < 10) return [];
      const time = MakeTime(new Date(position.time));
      const moon = bodyPosition(Body.Moon, time, observer);
      const phase = Illumination(Body.Moon, time).phase_angle;
      const limit = limitingMagnitude(
        plan.input.sky,
        plan.input.equipment,
        sample.sunAltDeg,
        position.altDeg,
        moon.altDeg,
        phase,
        separation(position, moon),
      );
      const margin = limit - effectiveMagnitude(row.mag, position.altDeg, row.kind);
      return margin >= 0 ? [{ ...position, margin }] : [];
    })
    .sort((a, b) => b.margin - a.margin || b.altDeg - a.altDeg || a.time.localeCompare(b.time));
  expect(object.best.time).toBe(required(candidates[0]).time);
  expect(object.visibleFrom).toBe(required(candidates.map((p) => p.time).sort()[0]));
  expect(object.visibleTo).toBe(
    required(
      candidates
        .map((p) => p.time)
        .sort()
        .at(-1),
    ),
  );
});
