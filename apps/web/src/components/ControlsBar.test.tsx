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
});
