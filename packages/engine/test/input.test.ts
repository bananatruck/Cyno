import { expect, it } from "vitest";
import { parsePlanInput, planNight, PlanInputError, resolveTimeZone } from "../src/index";
import type { InputError } from "../src/types";
const valid = { latitude: 33.77, longitude: -118.19, date: "2026-11-17" };
const invalid: [InputError["field"], unknown][] = [
  ["input", null],
  ["input", []],
  ["latitude", 90 + 1],
  ["latitude", -90 - 1],
  ["latitude", "33.77"],
  ["latitude", NaN],
  ["latitude", Infinity],
  ["longitude", 180 + 1],
  ["longitude", -180 - 1],
  ["longitude", null],
  ["longitude", NaN],
  ["date", "2026-11"],
  ["date", "2026-11-31"],
  ["date", null],
  ["timeZone", "Unknown/Zone"],
  ["timeZone", null],
  ["timeZone", ""],
  ["equipment", "camera"],
  ["sky", "bright"],
  ["elevationMeters", NaN],
  ["elevationMeters", "0"],
  ["elevationMeters", Number.MAX_VALUE],
  ["stepMinutes", 1 - 1],
  ["stepMinutes", 60 + 1],
  ["stepMinutes", NaN],
  ["stepMinutes", "10"],
  ["cloudCover", null],
  ["cloudCover", [{ time: "2026-11-18T05:00:00Z", percent: 100 + 1 }]],
  ["cloudCover", [{ time: "2026-11-18T05:00:00Z", percent: -1 }]],
  ["cloudCover", [{ time: "2026-11-18T05:00:00Z", percent: NaN }]],
  ["cloudCover", [{ time: "2026-11-31T05:00:00Z", percent: 0 }]],
  ["cloudCover", [{ time: "2026-11-18T24:00:00Z", percent: 0 }]],
  ["cloudCover", [{ time: "bad", percent: 0 }]],
  ["cloudCover", [{}]],
];
it.each(invalid)("rejects %s with value %j", (field, value) => {
  const raw = field === "input" ? value : { ...valid, [field]: value };
  const result = parsePlanInput(raw);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors.some((e) => e.field === field && e.message.length > 0)).toBe(true);
  try {
    planNight(raw as Parameters<typeof planNight>[0]);
    throw new Error("Expected input error.");
  } catch (error) {
    expect(error).toBeInstanceOf(PlanInputError);
    if (error instanceof PlanInputError) expect(error.errors.some((e) => e.field === field)).toBe(true);
  }
});
it("reports all invalid fields together", () => {
  const result = parsePlanInput({});
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors.map((e) => e.field)).toEqual(["latitude", "longitude", "date"]);
});
it("resolves the location and fills defaults", () => {
  const plan = planNight(valid);
  expect(resolveTimeZone(valid.latitude, valid.longitude)).toBe("America/Los_Angeles");
  expect(plan.input).toEqual({
    ...valid,
    timeZone: "America/Los_Angeles",
    elevationMeters: 0,
    stepMinutes: 10,
    equipment: "eye",
    sky: "suburban",
    cloudCover: null,
  });
});
it("validates coordinates passed to the zone resolver", () => {
  expect(() => resolveTimeZone(NaN, valid.longitude)).toThrow(PlanInputError);
  expect(() => resolveTimeZone(valid.latitude, Infinity)).toThrow(PlanInputError);
});
it("accepts inclusive field boundaries and fractional steps", () => {
  for (const latitude of [-90, 90])
    for (const longitude of [-180, 180])
      expect(parsePlanInput({ ...valid, latitude, longitude, stepMinutes: 1, cloudCover: [] }).ok).toBe(true);
  expect(parsePlanInput({ ...valid, stepMinutes: 60 }).ok).toBe(true);
  expect(parsePlanInput({ ...valid, stepMinutes: (1 + 60) / 2 }).ok).toBe(true);
});
