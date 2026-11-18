import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { planNight } from "@cyno/engine";
import { formatDarkAndMoonSummary } from "@/lib/format";
import { VerdictBanner } from "./VerdictBanner";

afterEach(() => {
  cleanup();
});

const longBeach = planNight({
  latitude: 33.77,
  longitude: -118.19,
  date: "2026-11-17",
  sky: "suburban",
  equipment: "eye",
});

describe("VerdictBanner", () => {
  it("shows the dark window once, in one summary line built from the plan", () => {
    expect(longBeach.verdict.label).not.toBe("no-go");
    render(<VerdictBanner plan={longBeach} placeName="Long Beach, CA" weatherStatus="offline" />);
    const banner = screen.getByRole("region", { name: "Tonight's verdict" });
    const text = banner.textContent ?? "";

    const summary = formatDarkAndMoonSummary(longBeach);
    if (!summary) throw new Error("Expected a dark window summary");
    expect(summary).toMatch(
      /^Dark \d\d:\d\d to \d\d:\d\d \(\d+\.\d hours\)\. Waxing Gibbous Moon, \d+% lit, up for \d+\.\d dark hours\.$/,
    );
    expect(screen.getByText(summary)).toBeTruthy();
    expect(text.match(/Dark /g)).toHaveLength(1);
    expect(text).not.toContain("Dark from");
    expect(text).not.toMatch(/The \d+% Moon is up/);
    expect(text).toContain("Cloud cover is unknown.");
  });

  it("names the place and its time zone without a middle dot", () => {
    render(<VerdictBanner plan={longBeach} placeName="Long Beach, CA" weatherStatus="offline" />);
    const banner = screen.getByRole("region", { name: "Tonight's verdict" });
    expect(banner.textContent).toContain("Long Beach, CA, Los Angeles time");
    expect(banner.textContent).not.toContain("\u00b7");
  });

  it("states whether a cloud forecast is in use", () => {
    render(<VerdictBanner plan={longBeach} placeName="Long Beach, CA" weatherStatus="offline" />);
    expect(screen.getByRole("status", { name: "Cloud forecast" }).textContent).toBe(
      "No cloud forecast (offline). Ranking ignores clouds.",
    );
    cleanup();
    render(<VerdictBanner plan={longBeach} placeName="Long Beach, CA" weatherStatus="ok" />);
    expect(screen.getByRole("status", { name: "Cloud forecast" }).textContent).toBe(
      "Open-Meteo cloud forecast in use.",
    );
  });

  it("shows the polar-day explanation and every verdict reason for Tromso on 2026-06-21", () => {
    const polarDayPlan = planNight({
      latitude: 69.65,
      longitude: 18.96,
      date: "2026-06-21",
    });

    expect(polarDayPlan.condition).toBe("polar-day");
    expect(polarDayPlan.verdict.label).toBe("no-go");

    render(<VerdictBanner plan={polarDayPlan} placeName="Tromso" weatherStatus="out-of-range" />);

    const note = screen.getByRole("region", { name: "Sky condition note" });
    expect(note.textContent).toContain("Polar day: the Sun stays above the horizon all night.");
    for (const reason of polarDayPlan.verdict.reasons) {
      expect(within(note).getByText(reason, { exact: false })).toBeTruthy();
    }
    expect(note.textContent).toContain(
      "Try a date nearer the winter solstice, or choose a location closer to the equator.",
    );
  });

  it("gives polar-day advice that holds in the southern hemisphere", () => {
    const antarcticDay = planNight({ latitude: -75, longitude: 0, date: "2026-12-21" });
    expect(antarcticDay.condition).toBe("polar-day");
    render(<VerdictBanner plan={antarcticDay} placeName="Antarctica" weatherStatus="out-of-range" />);
    const note = screen.getByRole("region", { name: "Sky condition note" });
    expect(note.textContent).toContain("closer to the equator");
    expect(note.textContent).not.toMatch(/south|north|autumn/i);
  });

  it("carries the anchor that the ranked list's empty state links to", () => {
    render(<VerdictBanner plan={longBeach} placeName="Long Beach, CA" weatherStatus="offline" />);
    expect(screen.getByRole("region", { name: "Tonight's verdict" }).id).toBe("tonights-verdict");
  });
});
