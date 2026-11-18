import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ControlsBar } from "./ControlsBar";

afterEach(() => {
  cleanup();
});

function ControlsHarness({ initialLat = "33.77" }: { initialLat?: string }) {
  const [latText, setLatText] = useState(initialLat);
  const [lonText, setLonText] = useState("-118.19");
  const [date, setDate] = useState("2026-11-17");

  return (
    <ControlsBar
      placeName="Long Beach, CA"
      latText={latText}
      lonText={lonText}
      date={date}
      sky="suburban"
      equipment="eye"
      redMode={false}
      onToggleRedMode={() => {}}
      onSelectPreset={() => {}}
      onLatChange={setLatText}
      onLonChange={setLonText}
      onDateChange={setDate}
      onSkyChange={() => {}}
      onEquipmentChange={() => {}}
      onUseGeoLocation={() => {}}
    />
  );
}

describe("ControlsBar", () => {
  it("shows the parsePlanInput error for latitude 95", () => {
    render(<ControlsHarness />);

    const latInput = screen.getByLabelText("Latitude");
    fireEvent.change(latInput, { target: { value: "95" } });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Latitude must be between -90° and 90°.");
  });

  it("links each field error to its input with aria-describedby", () => {
    render(<ControlsHarness />);
    const latInput = screen.getByLabelText("Latitude");
    const lonInput = screen.getByLabelText("Longitude");
    expect(latInput.hasAttribute("aria-describedby")).toBe(false);

    fireEvent.change(latInput, { target: { value: "95" } });
    fireEvent.change(lonInput, { target: { value: "200" } });

    for (const [input, message] of [
      [latInput, "Latitude must be between -90° and 90°."],
      [lonInput, "Longitude must be between -180° and 180°."],
    ] as const) {
      const describedBy = input.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy!)?.textContent).toBe(message);
    }
    expect(screen.getAllByRole("alert")).toHaveLength(2);

    fireEvent.change(latInput, { target: { value: "45" } });
    expect(latInput.hasAttribute("aria-describedby")).toBe(false);
  });

  it("summarises the place on one line and the full date, sky and equipment on a second line", () => {
    render(<ControlsHarness />);
    const summary = screen
      .getAllByRole("button", { expanded: false })
      .find((button) => button.getAttribute("aria-controls") === "cyno-controls-sheet");
    if (!summary) throw new Error("Expected the controls summary button");
    const lines = Array.from(summary.querySelectorAll(":scope > span > span"), (line) => line.textContent);
    expect(lines).toEqual(["Long Beach, CA", "2026-11-17, Suburban sky, Eye"]);
    expect(summary.querySelector(".truncate")).toBeNull();
  });

  it("gives every control a label", () => {
    render(<ControlsHarness />);
    for (const control of document.querySelectorAll("button, input")) {
      const name =
        control.getAttribute("aria-label") ??
        ((control as HTMLInputElement).labels?.[0]?.textContent || control.textContent);
      expect(name?.trim(), control.outerHTML).toBeTruthy();
    }
  });
});
