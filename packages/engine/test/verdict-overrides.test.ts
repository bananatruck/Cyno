import { expect, it } from "vitest";
import { planNight } from "../src/index";
import { HOUR, nightWindow } from "../src/time";

const longBeach = {
  latitude: 33.77,
  longitude: -118.19,
  date: "2026-11-09",
  timeZone: "America/Los_Angeles",
};

it("makes a fully overcast Long Beach night no-go with the cloud reason first", () => {
  const window = nightWindow(longBeach.date, longBeach.timeZone);
  const cloudCover = Array.from({ length: 24 }, (_, i) => ({
    time: new Date(Date.parse(window.start) + i * HOUR).toISOString(),
    percent: 100,
  }));
  const plan = planNight({ ...longBeach, cloudCover });
  expect(plan.objects).toEqual([]);
  expect(plan.verdict.label).toBe("no-go");
  expect(plan.verdict.score).toBe(34);
  expect(plan.verdict.reasons[0]).toBe("Clouds cover the sky for most of the dark hours (100% on average).");
  // The cloud reason already explains the empty list; no second, redundant reason is added.
  expect(plan.verdict.reasons.filter((r) => r.startsWith("Clouds"))).toHaveLength(1);
  expect(plan.verdict.reasons).not.toContain("Nothing is bright enough for this sky and equipment tonight.");
});

it("caps an 80% cloud verdict even when uncovered hours still offer visible targets", () => {
  const dark = planNight(longBeach).darkWindow;
  if (!dark) throw new Error("Expected dark window");
  const plan = planNight({
    ...longBeach,
    cloudCover: Array.from({ length: Math.ceil(dark.hours / 2) }, (_, i) => ({
      time: new Date(Date.parse(dark.start) + i * HOUR).toISOString(),
      percent: 80,
    })),
  });
  expect(plan.objects.length).toBeGreaterThan(0);
  expect(plan.verdict.label).toBe("no-go");
  expect(plan.verdict.score).toBe(34);
  expect(plan.verdict.reasons[0]).toBe("Clouds cover the sky for most of the dark hours (80% on average).");
});

it("keeps the darkness reason, not a brightness reason, when a bright night shows nothing", () => {
  const plan = planNight({
    latitude: 65.7,
    longitude: 8,
    date: "2026-06-21",
    timeZone: "UTC",
    stepMinutes: 60,
  });
  expect(plan.objects).toEqual([]);
  expect(plan.verdict.label).toBe("no-go");
  expect(plan.verdict.score).toBeLessThanOrEqual(34);
  expect(plan.verdict.reasons.join(" ")).toMatch(/never gets dark|twilight/);
  expect(plan.verdict.reasons).not.toContain("Nothing is bright enough for this sky and equipment tonight.");
});

it("does not add a brightness reason when the night is already no-go for darkness", () => {
  const plan = planNight({ latitude: 69.65, longitude: 18.96, date: "2026-06-21", timeZone: "Europe/Oslo" });
  expect(plan.condition).toBe("polar-day");
  expect(plan.verdict.label).toBe("no-go");
  expect(plan.verdict.reasons).toEqual(["The Sun never sets here tonight."]);
});
