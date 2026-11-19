import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StarsBackground } from "./stars-background";

function mediaQuery(initial: boolean) {
  let matches = initial;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      get matches() {
        return matches;
      },
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
        listeners.add(listener),
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
        listeners.delete(listener),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  return {
    change(next: boolean) {
      matches = next;
      listeners.forEach((listener) => listener({ matches: next } as MediaQueryListEvent));
    },
  };
}

const context = {
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  fillStyle: "",
};

beforeEach(() => {
  Object.assign(context, {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillStyle: "",
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  vi.stubGlobal("ResizeObserver", undefined);
  document.documentElement.removeAttribute("data-mode");
});

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-mode");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("StarsBackground", () => {
  it("stops and resumes animation when the reduced-motion preference changes", async () => {
    const media = mediaQuery(false);
    const requestFrame = vi.fn(() => 17);
    const cancelFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);
    render(<StarsBackground starDensity={0.00001} />);
    await waitFor(() => expect(requestFrame).toHaveBeenCalled());
    const initialFrameCount = requestFrame.mock.calls.length;
    const initialCancelCount = cancelFrame.mock.calls.length;

    act(() => media.change(true));
    await waitFor(() => expect(cancelFrame.mock.calls.length).toBeGreaterThan(initialCancelCount));
    const frameCountWhileReduced = requestFrame.mock.calls.length;
    expect(frameCountWhileReduced).toBe(initialFrameCount);

    act(() => media.change(false));
    await waitFor(() => expect(requestFrame.mock.calls.length).toBeGreaterThan(frameCountWhileReduced));
  });

  it("redraws the existing static stars in red when data-mode changes", async () => {
    mediaQuery(true);
    render(<StarsBackground starDensity={0.00001} />);
    await waitFor(() => expect(context.fill).toHaveBeenCalled());
    const initialArcs = context.arc.mock.calls.map((call) => [...call]);
    expect(context.fillStyle).toMatch(/^rgba\(244, 239, 226,/);

    act(() => document.documentElement.setAttribute("data-mode", "red"));
    await waitFor(() => expect(context.fillStyle).toMatch(/^rgba\(255, 90, 78,/));
    expect(initialArcs.length).toBeGreaterThan(0);
    expect(context.arc.mock.calls.slice(initialArcs.length)).toEqual(initialArcs);
  });

  it("stops animating when reduced motion turns on just before it subscribes", async () => {
    const media = mediaQuery(false);
    const original = window.matchMedia;
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => {
        const list = original(query);
        return {
          get matches() {
            return list.matches;
          },
          addEventListener: (type: "change", listener: (event: MediaQueryListEvent) => void) => {
            media.change(true);
            list.addEventListener(type, listener);
          },
          removeEventListener: list.removeEventListener,
        };
      }),
    );
    const requestFrame = vi.fn(() => 17);
    const cancelFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);
    render(<StarsBackground starDensity={0.00001} />);
    await waitFor(() => expect(context.fill).toHaveBeenCalled());

    // Every frame scheduled before the preference was read has been cancelled, and none is pending.
    expect(requestFrame.mock.calls.length).toBe(cancelFrame.mock.calls.length);
  });
});
