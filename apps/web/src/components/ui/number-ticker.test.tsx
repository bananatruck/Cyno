import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NumberTicker } from "./number-ticker";

interface MediaQueryController {
  setReducedMotion: (matches: boolean) => void;
}

function mockReducedMotion(initial: boolean): MediaQueryController {
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
    setReducedMotion(next) {
      matches = next;
      const event = { matches: next } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("NumberTicker", () => {
  it("uses zero as the initial displayed value when motion is enabled", () => {
    mockReducedMotion(false);
    render(<NumberTicker value={42} delay={10} />);
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("shows the final value immediately when reduced motion is preferred", () => {
    mockReducedMotion(true);
    render(<NumberTicker value={42} delay={10} />);
    expect(screen.getByText("42")).toBeTruthy();
  });

  it("stops a pending count and shows the final value when reduced motion is enabled", () => {
    const media = mockReducedMotion(false);
    render(<NumberTicker value={42} delay={10} />);
    expect(screen.getByText("0")).toBeTruthy();

    act(() => media.setReducedMotion(true));
    expect(screen.getByText("42")).toBeTruthy();
  });
});
