import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NightTimeline } from "./NightTimeline";
import { night, polarDay } from "./test-plans";

afterEach(cleanup);
const sunset = night.events.find((event) => event.kind === "sunset");
const sunrise = night.events.find((event) => event.kind === "sunrise");
if (!sunset || !sunrise) throw new Error("Expected sunset and sunrise in real engine fixture");
const samples = night.timeline.filter((sample) => sample.time >= sunset.time && sample.time <= sunrise.time);
const first = samples[0];
const second = samples[1];
const last = samples.at(-1);
if (!first || !second || !last) throw new Error("Expected night timeline samples");
const firstTime = first.time;

function StatefulTimeline({ onTimeChange }: { onTimeChange: (time: string) => void }) {
  const [time, setTime] = useState(firstTime);
  return (
    <NightTimeline
      plan={night}
      time={time}
      selectedId={null}
      onTimeChange={(next) => {
        setTime(next);
        onTimeChange(next);
      }}
    />
  );
}

describe("NightTimeline", () => {
  it("labels local hours in the plan's zone", () => {
    render(
      <NightTimeline
        plan={night}
        time={first.time}
        selectedId={night.objects[0]?.id ?? null}
        onTimeChange={vi.fn()}
      />,
    );
    const labels = Array.from(
      document.querySelectorAll(".cyno-hour-label"),
      (element) => element.textContent,
    );
    expect(labels[0]).toBe("17");
    expect(labels).toContain("00");
    expect(labels.at(-1)).toBe("06");
    expect(screen.getByRole("slider").getAttribute("aria-valuetext")).toBe("16:50 Los Angeles time");
    expect(screen.getByText("Los Angeles time")).toBeTruthy();
  });
  it("steps and jumps to exact sample times using the keyboard", () => {
    const onTimeChange = vi.fn();
    render(<NightTimeline plan={night} time={first.time} selectedId={null} onTimeChange={onTimeChange} />);
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(onTimeChange).toHaveBeenLastCalledWith(second.time);
    fireEvent.keyDown(slider, { key: "End" });
    expect(onTimeChange).toHaveBeenLastCalledWith(last.time);
    fireEvent.keyDown(slider, { key: "Home" });
    expect(onTimeChange).toHaveBeenLastCalledWith(first.time);
    fireEvent.keyDown(slider, { key: "PageUp" });
    expect(onTimeChange).toHaveBeenLastCalledWith(new Date(Date.parse(first.time) + 3_600_000).toISOString());
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(onTimeChange).toHaveBeenLastCalledWith(first.time);
  });
  it("uses the latest controlled time for consecutive arrow-key steps", () => {
    const onTimeChange = vi.fn();
    render(<StatefulTimeline onTimeChange={onTimeChange} />);
    const slider = screen.getByRole("slider");

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyDown(slider, { key: "ArrowLeft" });

    expect(onTimeChange.mock.calls).toEqual([[samples[1]?.time], [samples[2]?.time], [samples[1]?.time]]);
  });
  it("steps with vertical arrows and prevents their default scrolling", () => {
    const onTimeChange = vi.fn();
    render(<NightTimeline plan={night} time={second.time} selectedId={null} onTimeChange={onTimeChange} />);
    const slider = screen.getByRole("slider");

    expect(fireEvent.keyDown(slider, { key: "ArrowUp" })).toBe(false);
    expect(onTimeChange).toHaveBeenLastCalledWith(samples[2]?.time);
    expect(fireEvent.keyDown(slider, { key: "ArrowDown" })).toBe(false);
    expect(onTimeChange).toHaveBeenLastCalledWith(first.time);
  });
  it("reuses hour ticks when only the selected time changes", () => {
    const OriginalDateTimeFormat = Intl.DateTimeFormat;
    const optionsSeen: Intl.DateTimeFormatOptions[] = [];
    const DateTimeFormatProxy = new Proxy(OriginalDateTimeFormat, {
      construct(target, args: ConstructorParameters<typeof Intl.DateTimeFormat>) {
        optionsSeen.push(args[1] ?? {});
        return Reflect.construct(target, args);
      },
    });
    Object.defineProperty(Intl, "DateTimeFormat", {
      configurable: true,
      value: DateTimeFormatProxy,
    });
    try {
      const { rerender } = render(
        <NightTimeline plan={night} time={first.time} selectedId={null} onTimeChange={vi.fn()} />,
      );
      rerender(<NightTimeline plan={night} time={second.time} selectedId={null} onTimeChange={vi.fn()} />);
    } finally {
      Object.defineProperty(Intl, "DateTimeFormat", {
        configurable: true,
        value: OriginalDateTimeFormat,
      });
    }

    const minuteOnlyFormatterCalls = optionsSeen.filter(
      (options) => options.minute === "2-digit" && options.hour === undefined,
    );
    expect(minuteOnlyFormatterCalls).toHaveLength(1);
  });
  it("snaps pointer scrubbing to the endpoint samples and captures a drag", () => {
    const onTimeChange = vi.fn();
    render(<NightTimeline plan={night} time={first.time} selectedId={null} onTimeChange={onTimeChange} />);
    const slider = screen.getByRole("slider");
    // jsdom has no layout or native pointer capture. Simulate only those browser boundaries.
    vi.spyOn(slider, "getBoundingClientRect").mockReturnValue({
      x: 10,
      y: 0,
      left: 10,
      top: 0,
      right: 810,
      bottom: 148,
      width: 800,
      height: 148,
      toJSON: () => ({}),
    });
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    Object.defineProperties(slider, {
      setPointerCapture: { value: setPointerCapture },
      hasPointerCapture: { value: () => true },
      releasePointerCapture: { value: releasePointerCapture },
    });
    const pointer = (type: string, clientX: number) => {
      const event = new MouseEvent(type, { bubbles: true, clientX, button: 0 });
      Object.defineProperty(event, "pointerId", { value: 7 });
      fireEvent(slider, event);
    };
    pointer("pointerdown", 10);
    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(onTimeChange).toHaveBeenLastCalledWith(first.time);
    pointer("pointermove", 900);
    expect(onTimeChange).toHaveBeenLastCalledWith(last.time);
    pointer("pointerup", 900);
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
  });
  it("renders and scrubs the full window during polar day", () => {
    const onTimeChange = vi.fn();
    render(
      <NightTimeline
        plan={polarDay}
        time={polarDay.window.start}
        selectedId={null}
        onTimeChange={onTimeChange}
      />,
    );
    const slider = screen.getByRole("slider");
    expect(slider.getAttribute("aria-valuemin")).toBe(String(Date.parse(polarDay.window.start)));
    expect(slider.getAttribute("aria-valuemax")).toBe(String(Date.parse(polarDay.window.end)));
    expect(screen.getByText("No dark window tonight")).toBeTruthy();
    fireEvent.keyDown(slider, { key: "End" });
    expect(onTimeChange).toHaveBeenCalledWith(polarDay.window.end);
  });
});
