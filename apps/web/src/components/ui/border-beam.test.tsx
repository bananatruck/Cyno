import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BorderBeam } from "./border-beam";

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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BorderBeam", () => {
  it("switches to static motion when reduced motion is enabled after mount", () => {
    const media = mockReducedMotion(false);
    const { container } = render(
      <div className="relative size-20 rounded-lg">
        <BorderBeam />
      </div>,
    );
    const beam = container.querySelector("[data-border-beam]");
    expect(beam).toBeTruthy();
    expect(beam?.getAttribute("data-motion")).toBe("animated");

    act(() => media.setReducedMotion(true));
    expect(beam?.getAttribute("data-motion")).toBe("static");
  });
});
