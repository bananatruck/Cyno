import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SkyChart } from "./SkyChart";
import { nearest } from "./chart-utils";
import { night, polarDay } from "./test-plans";
import { planNight } from "@cyno/engine";

afterEach(cleanup);
const time = "2026-11-18T05:03:00.000Z";
const CHART_RADIUS = 200;
const LABEL_FONT_SIZE = 17;
const DOT_PADDING = 2;

function boxOverlapsCircle(
  box: { left: number; right: number; top: number; bottom: number },
  centerX: number,
  centerY: number,
  radius: number,
) {
  const closestX = Math.max(box.left, Math.min(centerX, box.right));
  const closestY = Math.max(box.top, Math.min(centerY, box.bottom));
  return Math.hypot(centerX - closestX, centerY - closestY) < radius;
}

function altitudeRingLabelBoxes() {
  return [30, 60].map((alt) => {
    const y = (-CHART_RADIUS * (90 - alt)) / 90 + 14;
    const name = `${alt}°`;
    const width = name.length * LABEL_FONT_SIZE * 0.6;
    return {
      name,
      left: 5,
      right: 5 + width,
      top: y - LABEL_FONT_SIZE,
      bottom: y + LABEL_FONT_SIZE * 0.2,
    };
  });
}

function renderedObjectDots() {
  return Array.from(document.querySelectorAll<SVGGElement>('[role="button"]')).map((group) => {
    const transform = group.getAttribute("transform") ?? "";
    const match = transform.match(/^translate\(([-\d.]+) ([-\d.]+)\)$/);
    if (!match) throw new Error(`Unexpected object transform: ${transform}`);
    const x = Number(match[1]);
    const y = Number(match[2]);
    const label = group.querySelector("text");
    const dot = Array.from(group.querySelectorAll("circle")).find((circle) => {
      const fill = circle.getAttribute("fill");
      const r = Number(circle.getAttribute("r"));
      return fill && fill !== "transparent" && fill !== "none" && r <= 8;
    });
    if (!dot) throw new Error(`Expected a visible dot for ${label?.textContent ?? "object"}`);
    return {
      name: label?.textContent ?? null,
      x,
      y,
      radius: Number(dot.getAttribute("r")),
    };
  });
}

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
      objectName: label.textContent,
      left,
      right: left + width,
      top: baseline - fontSize,
      bottom: baseline + fontSize * 0.2,
    };
  });
}

describe("SkyChart", () => {
  it("draws Suhail from the catalogue on a southern night and lets it be selected", () => {
    const plan = planNight({
      latitude: -34,
      longitude: 151,
      date: "2026-07-15",
      timeZone: "Australia/Sydney",
    });
    const suhail = plan.objects.find((object) => object.id === "star-suhail");
    if (!suhail) throw new Error("Expected Suhail in the southern night plan");
    const onSelect = vi.fn();
    render(<SkyChart plan={plan} time={suhail.best.time} selectedId={suhail.id} onSelect={onSelect} />);
    const marker = screen.getByRole("button", { name: /^Suhail,/ });
    const dot = renderedObjectDots().find((candidate) => candidate.name === "Suhail");
    expect(dot?.radius).toBeGreaterThan(0);
    expect(marker.getAttribute("aria-pressed")).toBe("true");
    fireEvent.keyDown(marker, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("star-suhail");
  });
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
      const dots = renderedObjectDots();
      const rings = altitudeRingLabelBoxes();
      expect(boxes.length, `${localTime} should have multiple labels`).toBeGreaterThan(1);
      for (const box of boxes) {
        for (const [corner, x, y] of [
          ["top-left", box.left, box.top],
          ["top-right", box.right, box.top],
          ["bottom-left", box.left, box.bottom],
          ["bottom-right", box.right, box.bottom],
        ] as const) {
          expect(Math.hypot(x, y), `${localTime} ${box.objectName} ${corner}`).toBeLessThanOrEqual(
            CHART_RADIUS,
          );
        }
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
          expect(overlaps, `${localTime}: ${first.objectName} overlaps ${second.objectName}`).toBe(false);
        }
      }
      for (const box of boxes) {
        for (const dot of dots) {
          if (dot.name === box.objectName) continue;
          const hitsDot = boxOverlapsCircle(box, dot.x, dot.y, dot.radius + DOT_PADDING);
          expect(hitsDot, `${localTime}: ${box.objectName} overlaps dot ${dot.name}`).toBe(false);
        }
        for (const ring of rings) {
          const overlapsRing =
            box.left < ring.right && box.right > ring.left && box.top < ring.bottom && box.bottom > ring.top;
          expect(
            overlapsRing,
            `${localTime}: ${box.objectName} overlaps altitude ring label ${ring.name}`,
          ).toBe(false);
        }
      }
    }
  });
  it("keeps the selected Moon label off the Moon disc when the Moon is above the horizon", () => {
    const moon = night.objects.find((object) => object.kind === "moon");
    if (!moon) throw new Error("Expected Moon in Long Beach fixture");
    const localClock = new Intl.DateTimeFormat("en-GB", {
      timeZone: night.input.timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const visibleSamples = night.timeline.filter((candidate) => {
      const alt = nearest(moon.track, Date.parse(candidate.time))?.altDeg ?? -90;
      return alt >= 0;
    });
    expect(visibleSamples.length).toBeGreaterThan(0);
    for (const sample of visibleSamples) {
      const localTime = localClock.format(new Date(sample.time));
      cleanup();
      render(<SkyChart plan={night} time={sample.time} selectedId={moon.id} onSelect={vi.fn()} />);
      const moonDot = renderedObjectDots().find((dot) => dot.name === "Moon");
      const moonLabel = renderedLabelBoxes().find((box) => box.objectName === "Moon");
      if (!moonDot || !moonLabel) {
        throw new Error(`Expected Moon marker and label at ${localTime}`);
      }
      const hitsOwnDisc = boxOverlapsCircle(moonLabel, moonDot.x, moonDot.y, moonDot.radius + DOT_PADDING);
      expect(hitsOwnDisc, `${localTime}: Moon label overlaps Moon disc`).toBe(false);
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
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.keyDown(button, { key: " " });
    expect(onSelect.mock.calls).toEqual([[object.id], [object.id]]);
  });
  it("selects the nearest marker when two pointer hit areas overlap", () => {
    const firstObject = night.objects[0];
    const secondObject = night.objects[1];
    const firstPoint = firstObject?.track[0];
    const secondPoint = secondObject?.track[0];
    if (!firstObject || !secondObject || !firstPoint || !secondPoint) {
      throw new Error("Expected two objects with tracks");
    }
    const closePlan = {
      ...night,
      objects: [
        {
          ...firstObject,
          track: [{ ...firstPoint, time, altDeg: 45, azDeg: 0 }],
        },
        {
          ...secondObject,
          track: [{ ...secondPoint, time, altDeg: 48.6, azDeg: 0 }],
        },
      ],
    };
    const onSelect = vi.fn();
    render(<SkyChart plan={closePlan} time={time} selectedId={null} onSelect={onSelect} />);
    const svg = document.querySelector("figure > svg");
    if (!(svg instanceof SVGSVGElement)) throw new Error("Expected the sky chart SVG");
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 480,
      bottom: 480,
      width: 480,
      height: 480,
      toJSON: () => ({}),
    });
    const groups = screen.getAllByRole("button");
    const centers = groups.map((group) => {
      const match = group.getAttribute("transform")?.match(/^translate\(([-\d.]+) ([-\d.]+)\)$/);
      if (!match) throw new Error("Expected marker transform");
      return { x: Number(match[1]), y: Number(match[2]) };
    });
    expect(Math.hypot(centers[0]!.x - centers[1]!.x, centers[0]!.y - centers[1]!.y)).toBeCloseTo(8);
    expect(centers[1]!.x).toBeCloseTo(centers[0]!.x);
    expect(centers[1]!.y - centers[0]!.y).toBeCloseTo(8);

    // Both clicks land inside both 13-unit hit areas: 3 and 5 units away, then 6 and 2 units away.
    fireEvent.click(svg, { clientX: centers[0]!.x + 240, clientY: centers[0]!.y + 243 });
    fireEvent.click(svg, { clientX: centers[0]!.x + 240, clientY: centers[0]!.y + 246 });

    expect(onSelect.mock.calls).toEqual([[firstObject.id], [secondObject.id]]);
  });
  it("renders an empty polar day without a dark window", () => {
    expect(polarDay.objects).toHaveLength(0);
    expect(polarDay.darkWindow).toBeNull();
    render(<SkyChart plan={polarDay} time={polarDay.window.start} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText(/No planned objects/)).toBeTruthy();
  });
});
