import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ControlsBar } from "./ControlsBar";

afterEach(() => {
  cleanup();
});

function ControlsHarness({
  initialLat = "33.77",
  onUseGeoLocation = () => {},
}: {
  initialLat?: string;
  onUseGeoLocation?: (latitude: number, longitude: number) => void;
}) {
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
      onUseGeoLocation={onUseGeoLocation}
    />
  );
}

interface PendingLocate {
  success: PositionCallback;
  error: PositionErrorCallback;
}

function stubGeolocation(): PendingLocate[] {
  const requests: PendingLocate[] = [];
  vi.stubGlobal("navigator", {
    ...navigator,
    geolocation: {
      getCurrentPosition: (success: PositionCallback, error: PositionErrorCallback) => {
        requests.push({ success, error });
      },
    },
  });
  return requests;
}

function positionError(code: number): GeolocationPositionError {
  return {
    code,
    message: "",
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError;
}

function position(latitude: number, longitude: number): GeolocationPosition {
  return { coords: { latitude, longitude }, timestamp: 0 } as GeolocationPosition;
}

const summaryButton = () =>
  screen
    .getAllByRole("button")
    .find((button) => button.getAttribute("aria-controls") === "cyno-controls-sheet")!;
const controlsSheet = () => document.getElementById("cyno-controls-sheet")!;

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

  it("shows the field error for a coordinate that is not a plain decimal number", () => {
    render(<ControlsHarness initialLat="0x21" />);
    expect(screen.getByRole("alert").textContent).toBe("Latitude must be between -90° and 90°.");
  });

  describe("geolocation", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("uses the located position when nothing changed meanwhile", () => {
      const requests = stubGeolocation();
      const onUseGeoLocation = vi.fn();
      render(<ControlsHarness onUseGeoLocation={onUseGeoLocation} />);
      fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
      act(() => requests[0]!.success(position(51.5074, -0.1278)));
      expect(onUseGeoLocation).toHaveBeenCalledWith(51.51, -0.13);
    });

    it("ignores a position that arrives after a coordinate edit", () => {
      const requests = stubGeolocation();
      const onUseGeoLocation = vi.fn();
      render(<ControlsHarness onUseGeoLocation={onUseGeoLocation} />);
      fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
      fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "40" } });
      act(() => requests[0]!.success(position(51.5, -0.13)));
      expect(onUseGeoLocation).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Use my location" })).toHaveProperty("disabled", false);
    });

    it.each([
      [
        "choosing a preset",
        () => {
          fireEvent.click(screen.getByRole("button", { name: /^Place preset/ }));
          fireEvent.click(screen.getByRole("option", { name: /Tokyo/ }));
        },
      ],
      [
        "editing a coordinate",
        () => {
          fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "40" } });
        },
      ],
    ])("clears a location error after %s", (_change, changeLocation) => {
      const requests = stubGeolocation();
      render(<ControlsHarness />);
      fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
      act(() => requests[0]!.error(positionError(1)));
      expect(screen.queryByText(/Location access was denied/)).not.toBeNull();
      changeLocation();
      expect(screen.queryByText(/Location access was denied/)).toBeNull();
    });

    it("ignores a position that arrives after a preset is chosen", () => {
      const requests = stubGeolocation();
      const onUseGeoLocation = vi.fn();
      render(<ControlsHarness onUseGeoLocation={onUseGeoLocation} />);
      fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
      fireEvent.click(screen.getByRole("button", { name: /^Place preset/ }));
      fireEvent.click(screen.getByRole("option", { name: /Tokyo/ }));
      act(() => requests[0]!.success(position(51.5, -0.13)));
      expect(onUseGeoLocation).not.toHaveBeenCalled();
    });

    it.each([
      [1, "PERMISSION_DENIED", "Location access was denied. Choose a preset or enter coordinates manually."],
      [
        2,
        "POSITION_UNAVAILABLE",
        "Your device could not determine its location. Choose a preset or enter coordinates manually.",
      ],
      [
        3,
        "TIMEOUT",
        "Your location could not be found in time. Choose a preset or enter coordinates manually.",
      ],
    ])("explains error code %d (%s) with its own message", (code, _name, message) => {
      const requests = stubGeolocation();
      render(<ControlsHarness />);
      fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
      act(() => requests[0]!.error(positionError(code)));
      expect(screen.getByRole("status").textContent).toBe(message);
    });
  });

  describe("mobile controls panel", () => {
    it("opens with aria-expanded true when a field starts invalid, and can be closed", () => {
      render(<ControlsHarness initialLat="" />);
      expect(summaryButton().getAttribute("aria-expanded")).toBe("true");
      expect(controlsSheet().className).not.toContain("max-lg:hidden");

      fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "33.77" } });
      fireEvent.click(summaryButton());
      expect(summaryButton().getAttribute("aria-expanded")).toBe("false");
      expect(controlsSheet().className).toContain("max-lg:hidden");
    });

    it("lets the user close the panel while an error is still shown", () => {
      render(<ControlsHarness initialLat="95" />);
      fireEvent.click(summaryButton());
      expect(summaryButton().getAttribute("aria-expanded")).toBe("false");
      expect(controlsSheet().className).toContain("max-lg:hidden");
    });

    it("opens again when a new validation error appears", () => {
      render(<ControlsHarness />);
      expect(summaryButton().getAttribute("aria-expanded")).toBe("false");
      expect(controlsSheet().className).toContain("max-lg:hidden");
      fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "95" } });
      expect(summaryButton().getAttribute("aria-expanded")).toBe("true");
      expect(controlsSheet().className).not.toContain("max-lg:hidden");
    });
  });
});
