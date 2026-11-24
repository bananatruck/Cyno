import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
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

  // Motion's spring runs on real animation frames, so these two use real time.
  it("counts down once the delay passes while motion is allowed", async () => {
    mockReducedMotion(false);
    render(<NumberTicker value={42} direction="down" delay={0.05} />);
    expect(screen.getByText("42")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("0")).toBeTruthy(), { timeout: 3_000 });
  });

  it("cancels a pending downward count when reduced motion is enabled before its delay", async () => {
    const media = mockReducedMotion(false);
    render(<NumberTicker value={42} direction="down" delay={0.05} />);
    act(() => media.setReducedMotion(true));

    const seen = new Set<string>();
    const deadline = Date.now() + 600;
    while (Date.now() < deadline) {
      seen.add(screen.getByText(/^\d+$/).textContent ?? "");
      await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    }
    expect([...seen]).toEqual(["42"]);
  });

  it("formats the shown value with the current number of decimal places", () => {
    mockReducedMotion(true);
    const { rerender } = render(<NumberTicker value={42} decimalPlaces={0} />);
    expect(screen.getByText("42")).toBeTruthy();
    rerender(<NumberTicker value={42} decimalPlaces={2} />);
    expect(screen.getByText("42.00")).toBeTruthy();
  });

  it("follows a reduced-motion preference that changes just before it subscribes", () => {
    const media = mockReducedMotion(false);
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
            media.setReducedMotion(true);
            list.addEventListener(type, listener);
          },
          removeEventListener: list.removeEventListener,
        };
      }),
    );
    render(<NumberTicker value={42} delay={10} />);
    expect(screen.getByText("42")).toBeTruthy();
  });
});
