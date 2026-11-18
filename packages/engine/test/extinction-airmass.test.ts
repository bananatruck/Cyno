import { expect, it } from "vitest";
import { effectiveMagnitude, extinctionAirmass } from "../src/brightness";

it("uses KS91 equation 14 for direct extinction air mass", () => {
  expect(extinctionAirmass(0)).toBeCloseTo(40, 9);
  expect(extinctionAirmass(90)).toBeCloseTo(1 / (1 + 0.025 * Math.exp(-11)), 12);
  expect(extinctionAirmass(10)).toBeCloseTo(5.6386, 3);
  const mag = 1;
  const k = 0.25;
  expect(effectiveMagnitude(mag, 10, "star")).toBeCloseTo(mag + k * (extinctionAirmass(10) - 1), 12);
});
