import { describe, expect, it } from "vitest";
import { planNight } from "../src/index";
import { formatDarkWindowReason } from "../src/verdict";
import { clockFormatter } from "../src/time";

describe("formatDarkWindowReason", () => {
  it("uses Dark from for true night", () => {
    const plan = planNight({ latitude: 33.77, longitude: -118.19, date: "2026-11-17" });
    const dark = plan.darkWindow;
    if (!dark || dark.level !== "night") throw new Error("Expected a night-level dark window");
    const clock = clockFormatter(plan.input.timeZone);
    const reason = formatDarkWindowReason(dark, clock);
    expect(reason).toMatch(/^Dark from /);
    expect(reason).not.toContain("twilight");
    expect(plan.verdict.reasons).toContain(reason);
  });

  it("describes London summer solstice as astronomical twilight without implying full darkness", () => {
    const plan = planNight({
      latitude: 51.51,
      longitude: -0.13,
      date: "2026-06-21",
      timeZone: "Europe/London",
    });
    expect(plan.condition).toBe("no-astronomical-darkness");
    expect(plan.darkWindow?.level).toBe("astronomical-twilight");
    const clock = clockFormatter(plan.input.timeZone);
    const dark = plan.darkWindow!;
    const reason = formatDarkWindowReason(dark, clock);
    expect(reason).toMatch(
      /^Darkest from \d\d:\d\d to \d\d:\d\d \(\d+\.\d hours\), in astronomical twilight: the sky never gets fully dark\.$/,
    );
    expect(plan.verdict.reasons[0]).toBe(reason);
  });
});
