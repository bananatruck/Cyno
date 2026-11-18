import { describe, expect, it } from "vitest";
import { planNight } from "@cyno/engine";
import type { NightCondition } from "@cyno/engine";
import {
  describeConditionDirection,
  formatDarkAndMoonSummary,
  formatTimeHHMM,
  reasonsBesideDarkAndMoon,
} from "./format";

describe("describeConditionDirection", () => {
  const conditions: NightCondition[] = [
    "normal",
    "no-astronomical-darkness",
    "no-nautical-darkness",
    "white-night",
    "polar-day",
    "polar-night",
  ];

  it("sends polar-day and white-night observers towards the equator and the winter solstice", () => {
    for (const condition of ["polar-day", "white-night"] as const) {
      const suggestion = describeConditionDirection(condition)!.suggestion;
      expect(suggestion).toContain("closer to the equator");
      expect(suggestion).toContain("nearer the winter solstice");
    }
  });

  it.each(conditions)("gives advice for %s that holds in both hemispheres", (condition) => {
    const text = Object.values(describeConditionDirection(condition) ?? {}).join(" ");
    expect(text).not.toMatch(/\b(north|south)(ern|ward|wards)?\b/i);
    expect(text).not.toMatch(/\b(autumn|fall|spring)\b/i);
    expect(text).not.toMatch(/\b(summer|winter)\b(?! solstice)/i);
  });
});

describe("formatTimeHHMM", () => {
  it("rounds to the nearest minute instead of truncating", () => {
    expect(formatTimeHHMM("2026-11-18T02:14:30.000Z", "UTC")).toBe("02:15");
    expect(formatTimeHHMM("2026-11-18T02:14:29.999Z", "UTC")).toBe("02:14");
    expect(formatTimeHHMM("2026-11-18T23:59:45.000Z", "UTC")).toBe("00:00");
  });

  it("formats in the given time zone and falls back to UTC for an unknown zone", () => {
    expect(formatTimeHHMM("2026-11-18T02:14:51.000Z", "America/Los_Angeles")).toBe("18:15");
    expect(formatTimeHHMM("2026-11-18T02:14:51.000Z", "Not/A_Zone")).toBe("02:15");
    expect(formatTimeHHMM("not a time", "UTC")).toBe("--:--");
  });

  it("agrees with the engine's dark window reason for Long Beach on 2026-11-17", () => {
    const plan = planNight({ latitude: 33.77, longitude: -118.19, date: "2026-11-17" });
    const dark = plan.darkWindow;
    if (!dark) throw new Error("Expected a dark window");
    const start = formatTimeHHMM(dark.start, plan.input.timeZone);
    const end = formatTimeHHMM(dark.end, plan.input.timeZone);
    expect(plan.verdict.reasons).toContain(`Dark from ${start} to ${end} (${dark.hours.toFixed(1)} hours).`);
  });
});

describe("formatDarkAndMoonSummary", () => {
  const plan = planNight({ latitude: 33.77, longitude: -118.19, date: "2026-11-17" });

  it("builds one line from the dark window and the Moon", () => {
    const dark = plan.darkWindow!;
    const zone = plan.input.timeZone;
    expect(formatDarkAndMoonSummary(plan)).toBe(
      `Dark ${formatTimeHHMM(dark.start, zone)} to ${formatTimeHHMM(dark.end, zone)} (${dark.hours.toFixed(1)} hours). ` +
        `${plan.moon.phaseName} Moon, ${Math.round(plan.moon.illumination * 100)}% lit, ` +
        `up for ${plan.moon.hoursUpInDarkWindow.toFixed(1)} dark hours.`,
    );
  });

  it("does not repeat Moon in phase names that already end with it, and says when the Moon stays down", () => {
    const newMoon = { ...plan, moon: { ...plan.moon, phaseName: "New Moon", hoursUpInDarkWindow: 0 } };
    expect(formatDarkAndMoonSummary(newMoon)).toMatch(
      /\. New Moon, \d+% lit, not up during the dark hours\.$/,
    );
  });

  it("returns null without a dark window", () => {
    expect(formatDarkAndMoonSummary({ ...plan, darkWindow: null })).toBeNull();
  });
});

describe("reasonsBesideDarkAndMoon", () => {
  it("drops the engine's dark window and Moon sentences and keeps the rest", () => {
    const plan = planNight({ latitude: 33.77, longitude: -118.19, date: "2026-11-17" });
    expect(plan.verdict.reasons).toHaveLength(3);
    expect(reasonsBesideDarkAndMoon(plan.verdict.reasons)).toEqual(["Cloud cover is unknown."]);
    expect(
      reasonsBesideDarkAndMoon([
        "The sky only reaches nautical twilight: the Sun gets no lower than 15° below the horizon.",
        "Cloud cover averages 12%.",
      ]),
    ).toHaveLength(2);
  });
});
