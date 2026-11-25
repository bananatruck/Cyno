import { describe, expect, it } from "vitest";
import { planNight } from "../src/index";
import { moonInfo } from "../src/sky";
import { clockFormatter } from "../src/time";
import { Observer } from "astronomy-engine";
import { nightWindow } from "../src/time";
import { required, usno } from "./helpers";

it("names the Moon phase from longitude, not eight equal buckets", () => {
  const fixture = usno("usno_lb.json");
  const input = {
    latitude: 33.77,
    longitude: -118.19,
    date: "2026-11-17",
    timeZone: "America/Los_Angeles",
  };
  const plan = planNight(input);
  expect(plan.moon.phaseName).toBe(fixture.curphase);
});

it("rounds clock times to the nearest minute before formatting", () => {
  const clock = clockFormatter("UTC");
  expect(clock("2026-01-01T12:14:51.000Z")).toBe("12:15");
  expect(clock("2026-01-01T12:14:29.000Z")).toBe("12:14");
});

it("explains polar-day nights in the verdict", () => {
  const plan = planNight({
    latitude: 69.65,
    longitude: 18.96,
    date: "2026-06-21",
    timeZone: "Europe/Oslo",
  });
  expect(plan.condition).toBe("polar-day");
  expect(plan.verdict.reasons[0]).toBe("The Sun never sets here tonight.");
});

it("explains white-night conditions in the verdict", () => {
  let plan: ReturnType<typeof planNight> | undefined;
  for (let offset = 0; offset < 90 && !plan; offset++) {
    const date = new Date(Date.parse("2026-06-21T12:00:00Z") - offset * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const candidate = planNight({
      latitude: 69.65,
      longitude: 18.96,
      date,
      timeZone: "Europe/Oslo",
      stepMinutes: 60,
    });
    if (candidate.condition === "white-night") plan = candidate;
  }
  expect(required(plan).verdict.reasons[0]).toBe(
    "The Sun sets but stays within 6° of the horizon, so the sky never gets dark.",
  );
});

it("explains limited nautical darkness with the lowest Sun altitude", () => {
  let plan: ReturnType<typeof planNight> | undefined;
  for (let offset = 0; offset < 90 && !plan; offset++) {
    const date = new Date(Date.parse("2026-06-21T12:00:00Z") - offset * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const candidate = planNight({
      latitude: 69.65,
      longitude: 18.96,
      date,
      timeZone: "Europe/Oslo",
      stepMinutes: 10,
    });
    if (candidate.condition === "no-nautical-darkness") plan = candidate;
  }
  plan = required(plan);
  const lowest = Math.min(...plan.timeline.map((s) => s.sunAltDeg));
  const below = Math.round(Math.min(0, lowest) * -1);
  expect(plan.verdict.reasons[0]).toBe(
    `The sky only reaches nautical twilight: the Sun gets no lower than ${below}° below the horizon.`,
  );
  // SPEC: a nautical-only dark window earns no darkness points but is still scored on Moon and clouds,
  // so it can be marginal at best and is never forced to zero.
  expect(plan.verdict.score).toBeGreaterThan(0);
  expect(plan.verdict.score).toBeLessThan(65);
  expect(plan.verdict.label).not.toBe("go");
  expect(plan.verdict.reasons.some((r) => r.startsWith("Darkest from "))).toBe(true);
});

it("reports London no-astronomical-darkness with a normal dark-window verdict", () => {
  const plan = planNight({
    latitude: 51.51,
    longitude: -0.13,
    date: "2026-06-21",
    timeZone: "Europe/London",
  });
  expect(plan.condition).toBe("no-astronomical-darkness");
  expect(plan.darkWindow?.level).toBe("astronomical-twilight");
  expect(plan.verdict.reasons[0]).toMatch(
    /^Darkest from \d\d:\d\d to \d\d:\d\d \(\d+\.\d hours\), in astronomical twilight: the sky never gets fully dark\.$/,
  );
});

it("uses peak altitude only while the sky is dark when the object culminates in daytime", () => {
  const input = {
    latitude: 33.77,
    longitude: -118.19,
    date: "2026-11-17",
    timeZone: "America/Los_Angeles",
  };
  const plan = planNight(input);
  const vega = required(plan.objects.find((o) => o.id === "star-vega"));
  const trackPeak = Math.max(...vega.track.map((p) => p.altDeg));
  const darkPeak = Math.max(
    ...vega.track
      .filter((_, index) => required(plan.timeline[index]).sunAltDeg < -0.833)
      .map((p) => p.altDeg),
  );
  expect(trackPeak).toBeGreaterThan(darkPeak + 1);
  expect(vega.peakAltDeg).toBeCloseTo(darkPeak, 5);
  expect(vega.peakAltDeg).toBeLessThan(trackPeak - 1);
});

it("says the sky never gets dark for every hidden object on polar day", () => {
  const plan = planNight({
    latitude: 69.65,
    longitude: 18.96,
    date: "2026-06-21",
    timeZone: "Europe/Oslo",
  });
  expect(plan.objects).toEqual([]);
  expect(plan.hidden.length).toBeGreaterThan(0);
  expect(plan.hidden.every((o) => o.reason === "The sky never gets dark here tonight.")).toBe(true);
});

it("keeps moon phase naming stable at the dark-window midpoint", () => {
  const input = {
    latitude: 33.77,
    longitude: -118.19,
    date: "2026-11-17",
    timeZone: "America/Los_Angeles",
  };
  const plan = planNight(input);
  const window = nightWindow(input.date, input.timeZone);
  const start = Date.parse(window.start);
  const end = Date.parse(window.end);
  const observer = new Observer(input.latitude, input.longitude, 0);
  const fromMoonInfo = moonInfo(observer, start, end, plan.darkWindow);
  expect(fromMoonInfo.phaseName).toBe(plan.moon.phaseName);
});

describe("Moon-up wording", () => {
  it("does not call a short real Moon-up interval 0.0 hours", () => {
    // At Long Beach on 2026-06-12 the Moon is up for about 2 minutes (0.039 h) of the dark window.
    const plan = planNight({ latitude: 33.77, longitude: -118.19, date: "2026-06-12" });
    expect(plan.moon.hoursUpInDarkWindow).toBeGreaterThan(0);
    expect(plan.moon.hoursUpInDarkWindow).toBeLessThan(0.05);
    expect(plan.verdict.reasons).toContainEqual(
      expect.stringMatching(/^The \d+% Moon is up for less than 0\.1 dark hours\.$/),
    );
  });
});
