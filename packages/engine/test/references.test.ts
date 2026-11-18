import { describe, expect, it } from "vitest";
import { Body, Illumination, MakeTime, Observer, SearchMoonPhase } from "astronomy-engine";
import { planNight } from "../src/index";
import { bodyPosition } from "../src/positions";
import { skyEvents } from "../src/sky";
import { DAY, localNoon } from "../src/time";
import { civilDate, horizons, phases, required, usno, utc } from "./helpers";
const lb = { latitude: 33.77, longitude: -118.19, date: "2026-11-17", timeZone: "America/Los_Angeles" };
const tromso = { latitude: 69.65, longitude: 18.96, timeZone: "Europe/Oslo" };
const observer = new Observer(lb.latitude, lb.longitude, 0);
describe("USNO daily references", () => {
  for (const [file, place] of [
    ["usno_lb.json", lb],
    ["usno_tromso_dec.json", tromso],
    ["usno_tromso_jun.json", tromso],
  ] as const) {
    const fixture = usno(file);
    const date = civilDate(fixture);
    const midnight = utc(fixture, "00:00", fixture.tz);
    const events = skyEvents(new Observer(place.latitude, place.longitude, 0), midnight, midnight + DAY);
    for (const [body, rows] of [
      ["sun", fixture.sundata],
      ["moon", fixture.moondata],
    ] as const) {
      for (const row of rows) {
        const kind =
          row.phen === "Rise"
            ? `${body}rise`
            : row.phen === "Set"
              ? `${body}set`
              : row.phen === "Begin Civil Twilight"
                ? "civil-dawn"
                : row.phen === "End Civil Twilight"
                  ? "civil-dusk"
                  : null;
        if (kind && row.time)
          it(`${file}: ${kind}`, () => {
            const actual = required(events.find((e) => e.kind === kind));
            expect(
              Math.abs(Date.parse(actual.time) - utc(fixture, required(row.time), fixture.tz)) / 60000,
            ).toBeLessThanOrEqual(body === "moon" ? 2 : 1);
          });
      }
    }
    it(`${file}: polar behavior and illumination`, () => {
      const plan = planNight({ ...place, date });
      if (fixture.sundata.some((r) => r.phen === "Object continuously below the Horizon")) {
        expect(plan.condition).toBe("polar-night");
        expect(events.some((e) => e.kind === "sunrise" || e.kind === "sunset")).toBe(false);
      }
      if (fixture.sundata.some((r) => r.phen === "Object continuously above the Twilight Limit")) {
        expect(plan.condition).toBe("polar-day");
        expect(plan.objects).toEqual([]);
        expect(plan.darkWindow).toBeNull();
        expect(plan.verdict.label).toBe("no-go");
        expect(plan.verdict.reasons.length).toBeGreaterThan(0);
        expect(plan.timeline.every((s) => s.darkness === "day")).toBe(true);
      }
      const illumination = Illumination(Body.Moon, new Date(localNoon(date, place.timeZone))).phase_fraction;
      expect(`${Math.round(illumination * 100)}%`).toBe(fixture.fracillum);
    });
  }
});
const phaseAngles: Record<string, number> = {
  "New Moon": 0,
  "First Quarter": 90,
  "Full Moon": 180,
  "Last Quarter": 270,
};
describe("all USNO primary Moon phases", () => {
  const fixture = phases();
  it("reads every reference phase", () => expect(fixture.phasedata.length).toBe(fixture.numphases));
  for (const row of fixture.phasedata)
    it(`${civilDate(row)} ${row.phase}`, () => {
      const reference = utc(row, row.time);
      const found = required(SearchMoonPhase(required(phaseAngles[row.phase]), new Date(reference - DAY), 2));
      expect(Math.abs(found.date.getTime() - reference) / 60000).toBeLessThanOrEqual(2);
    });
});
describe("JPL Horizons airless topocentric positions", () => {
  for (const [file, body] of [
    ["hz_10.txt", Body.Sun],
    ["hz_301.txt", Body.Moon],
    ["hz_299.txt", Body.Venus],
    ["hz_499.txt", Body.Mars],
    ["hz_599.txt", Body.Jupiter],
    ["hz_699.txt", Body.Saturn],
  ] as const) {
    for (const row of horizons(file))
      it(`${body} at ${row.time}`, () => {
        const actual = bodyPosition(body, MakeTime(new Date(row.time)), observer);
        expect(actual.azDeg).toBeGreaterThanOrEqual(0);
        expect(actual.azDeg).toBeLessThan(360);
        const delta = Math.abs(actual.azDeg - row.azDeg);
        expect(Math.min(delta, 360 - delta)).toBeLessThanOrEqual(0.1);
        expect(Math.abs(actual.altDeg - row.altDeg)).toBeLessThanOrEqual(0.1);
      });
  }
  for (const [altitude, kind] of [
    [-12, "nautical-dusk"],
    [-18, "astronomical-dusk"],
  ] as const)
    it(`${kind} agrees with the minute curve`, () => {
      const rows = horizons("hz_sun_curve.txt");
      const index = rows.findIndex((r) => r.altDeg <= altitude);
      const before = required(rows[index - 1]),
        after = required(rows[index]);
      const crossing =
        Date.parse(before.time) +
        ((altitude - before.altDeg) / (after.altDeg - before.altDeg)) *
          (Date.parse(after.time) - Date.parse(before.time));
      const plan = planNight(lb);
      const event = required(plan.events.find((e) => e.kind === kind));
      expect(Math.abs(Date.parse(event.time) - crossing) / 60000).toBeLessThanOrEqual(1);
    });
});
