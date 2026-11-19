import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShootingStars } from "./shooting-stars";

let reducedMotion = false;
let onSubscribe: () => void = () => {};

beforeEach(() => {
  reducedMotion = false;
  onSubscribe = () => {};
  vi.useFakeTimers();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      get matches() {
        return reducedMotion;
      },
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(() => onSubscribe()),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1000 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 500 });
});

const viewport = {
  width: Object.getOwnPropertyDescriptor(window, "innerWidth"),
  height: Object.getOwnPropertyDescriptor(window, "innerHeight"),
};

afterEach(() => {
  for (const [name, descriptor] of [
    ["innerWidth", viewport.width],
    ["innerHeight", viewport.height],
  ] as const) {
    if (descriptor) Object.defineProperty(window, name, descriptor);
    else delete (window as Partial<Window>)[name];
  }
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ShootingStars", () => {
  it.each([
    ["right", 0.3, 1000],
    ["left", 0.8, 0],
  ])("starts on the %s edge, sampling the vertical position from viewport height", (_edge, sideRandom, x) => {
    vi.spyOn(Math, "random").mockReturnValue(0.5).mockReturnValueOnce(sideRandom).mockReturnValueOnce(0.9);
    render(<ShootingStars minDelay={1} maxDelay={1} />);

    act(() => vi.advanceTimersByTime(1));

    const star = document.querySelector("svg > rect");
    if (!star) throw new Error("Expected a shooting star");
    expect(Number(star.getAttribute("x"))).toBe(x);
    expect(Number(star.getAttribute("y"))).toBe(450);
  });

  it("stays hidden when reduced motion turns on just before it subscribes", () => {
    onSubscribe = () => {
      reducedMotion = true;
    };
    render(<ShootingStars minDelay={1} maxDelay={1} />);
    act(() => vi.advanceTimersByTime(10));
    expect(document.querySelector("svg")).toBeNull();
  });
});
