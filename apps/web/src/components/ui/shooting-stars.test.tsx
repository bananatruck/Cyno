import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShootingStars } from "./shooting-stars";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
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

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ShootingStars", () => {
  it.each([
    ["right", 0.3],
    ["left", 0.8],
  ])("samples the vertical start position from viewport height on the %s edge", (_edge, sideRandom) => {
    vi.spyOn(Math, "random").mockReturnValue(0.5).mockReturnValueOnce(sideRandom).mockReturnValueOnce(0.9);
    render(<ShootingStars minDelay={1} maxDelay={1} />);

    act(() => vi.advanceTimersByTime(1));

    const star = document.querySelector("svg > rect");
    if (!star) throw new Error("Expected a shooting star");
    expect(Number(star.getAttribute("y"))).toBe(450);
  });
});
