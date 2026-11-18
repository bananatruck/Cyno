import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SkyChart } from "./SkyChart";
import { nearest } from "./chart-utils";
import { night, polarDay } from "./test-plans";

afterEach(cleanup);
const time = "2026-11-18T05:03:00.000Z";

describe("SkyChart", () => {
  it("renders a button for each object above the horizon at the nearest sample", () => {
    const visible = night.objects.filter(
      (object) => (nearest(object.track, Date.parse(time))?.altDeg ?? -90) >= 0,
    );
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.length).toBeLessThan(night.objects.length);
    render(<SkyChart plan={night} time={time} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getAllByRole("button")).toHaveLength(visible.length);
    for (const object of visible) {
      expect(
        screen.getByRole("button", {
          name: new RegExp(`^${object.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},`),
        }),
      ).toBeTruthy();
    }
    expect(screen.getByText("21:03")).toBeTruthy();
  });
  it("selects objects with click, Enter, and Space", () => {
    const onSelect = vi.fn();
    const object = night.objects.find(
      (candidate) => (nearest(candidate.track, Date.parse(time))?.altDeg ?? -90) >= 0,
    );
    if (!object) throw new Error("Expected a visible object in real engine fixture");
    render(<SkyChart plan={night} time={time} selectedId={object.id} onSelect={onSelect} />);
    const button = screen
      .getAllByRole("button")
      .find((button) => button.getAttribute("aria-label")?.startsWith(`${object.name},`));
    if (!button) throw new Error("Expected object button");
    expect(button.getAttribute("tabindex")).toBe("0");
    expect(button.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.keyDown(button, { key: " " });
    expect(onSelect.mock.calls).toEqual([[object.id], [object.id], [object.id]]);
  });
  it("renders an empty polar day without a dark window", () => {
    expect(polarDay.objects).toHaveLength(0);
    expect(polarDay.darkWindow).toBeNull();
    render(<SkyChart plan={polarDay} time={polarDay.window.start} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText(/No planned objects/)).toBeTruthy();
  });
});
