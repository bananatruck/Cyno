import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { planNight } from "@cyno/engine";
import { VerdictBanner } from "./VerdictBanner";

afterEach(() => {
  cleanup();
});

describe("VerdictBanner", () => {
  it("shows the polar-day explanation for Tromso on 2026-06-21", () => {
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
    expect(note.textContent).toContain(polarDayPlan.verdict.reasons[0]!);
    expect(note.textContent).toContain("Try a date in autumn or winter, or choose a location further south.");
  });
});
