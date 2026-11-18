import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SkyChart } from "./SkyChart";
import { nearest } from "./chart-utils";
import { night, polarDay } from "./test-plans";

afterEach(cleanup);
const time = "2026-11-18T05:03:00.000Z";

function renderedLabelBoxes() {
  return Array.from(document.querySelectorAll<SVGTextElement>('[role="button"] > text')).map((label) => {
    const transform = label.parentElement?.getAttribute("transform") ?? "";
    const match = transform.match(/^translate\(([-\d.]+) ([-\d.]+)\)$/);
    if (!match) throw new Error(`Unexpected object transform: ${transform}`);
    const originX = Number(match[1]);
    const originY = Number(match[2]);
    const x = originX + Number(label.getAttribute("x"));
    const baseline = originY + Number(label.getAttribute("y"));
    const fontSize = Number(label.getAttribute("font-size"));
    const width = (label.textContent?.length ?? 0) * fontSize * 0.6;
    const anchor = label.getAttribute("text-anchor");
    const left = anchor === "end" ? x - width : anchor === "middle" ? x - width / 2 : x;
    return {
      name: label.textContent,
      left,
      right: left + width,
      top: baseline - fontSize,
      bottom: baseline + fontSize * 0.2,
    };
  });
}

describe("SkyChart", () => {
  it("fills its container as a square with readable labels at 320 pixels", () => {
    render(<SkyChart plan={night} time={time} selectedId={null} onSelect={vi.fn()} />);
    const svg = document.querySelector("figure > svg");
    if (!(svg instanceof SVGSVGElement)) throw new Error("Expected the sky chart SVG");
    const viewBox = svg.getAttribute("viewBox")?.split(/\s+/).map(Number);
    if (!viewBox || viewBox.length !== 4) throw new Error("Expected a four-value viewBox");
    const viewBoxWidth = viewBox[2];
    const viewBoxHeight = viewBox[3];
    if (viewBoxWidth === undefined || viewBoxHeight === undefined) {
      throw new Error("Expected viewBox dimensions");
    }
    expect(svg.getAttribute("width")).toBe("100%");
    expect(svg.style.maxWidth).toBe("none");
    expect(svg.style.aspectRatio).toBe("1 / 1");
    expect(viewBoxWidth).toBe(viewBoxHeight);
    for (const label of svg.querySelectorAll("text")) {
      const fontSize = Number(label.getAttribute("font-size"));
      expect((fontSize * 320) / viewBoxWidth, label.textContent ?? "label").toBeGreaterThanOrEqual(11);
    }
  });
  it("places non-overlapping labels inside the chart through the Long Beach night", () => {
    const localClock = new Intl.DateTimeFormat("en-GB", {
      timeZone: night.input.timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    for (const localTime of ["18:00", "21:00", "01:00", "05:00"]) {
      const sample = night.timeline.find(
        (candidate) => localClock.format(new Date(candidate.time)) === localTime,
      );
      if (!sample) throw new Error(`Expected a ${localTime} sample in the Long Beach plan`);
      cleanup();
      render(
        <SkyChart
          plan={night}
          time={sample.time}
          selectedId={night.objects.find((object) => object.name === "Mars")?.id ?? null}
          onSelect={vi.fn()}
        />,
      );
      const boxes = renderedLabelBoxes();
      expect(boxes.length, `${localTime} should have multiple labels`).toBeGreaterThan(1);
      for (const box of boxes) {
        expect(box.left, `${localTime} ${box.name} left edge`).toBeGreaterThanOrEqual(-200);
        expect(box.right, `${localTime} ${box.name} right edge`).toBeLessThanOrEqual(200);
        expect(box.top, `${localTime} ${box.name} top edge`).toBeGreaterThanOrEqual(-200);
        expect(box.bottom, `${localTime} ${box.name} bottom edge`).toBeLessThanOrEqual(200);
      }
      for (let index = 0; index < boxes.length; index += 1) {
        for (let other = index + 1; other < boxes.length; other += 1) {
          const first = boxes[index];
          const second = boxes[other];
          if (!first || !second) continue;
          const overlaps =
            first.left < second.right &&
            first.right > second.left &&
            first.top < second.bottom &&
            first.bottom > second.top;
          expect(overlaps, `${localTime}: ${first.name} overlaps ${second.name}`).toBe(false);
        }
      }
    }
  });
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
    const caption = document.querySelector("figcaption");
    expect(caption?.textContent).toContain("21:03 Los Angeles time");
    expect(caption?.textContent).not.toContain("\u00b7");
    expect(caption?.textContent).not.toContain("America/Los_Angeles");
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
