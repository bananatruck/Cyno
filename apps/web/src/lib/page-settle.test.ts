import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SETTLE_DEADLINE_MS, waitForPageSettle } from "./page-settle";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(0));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("waitForPageSettle", () => {
  it("rejects within the deadline when fonts are still loading", async () => {
    let resolveFonts: (() => void) | undefined;
    const fontsReady = new Promise<void>((resolve) => {
      resolveFonts = resolve;
    });
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        status: "loading",
        get ready() {
          return fontsReady;
        },
      },
    });
    document.getAnimations = () => [];

    const pending = waitForPageSettle();
    const assertion = expect(pending).rejects.toThrow(/Font loading: loading/);

    await vi.advanceTimersByTimeAsync(SETTLE_DEADLINE_MS + 50);
    await assertion;

    resolveFonts?.();
  });

  it("reports running animations when the deadline expires", async () => {
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        status: "loaded",
        ready: Promise.resolve(),
      },
    });
    const animation = {
      playState: "running",
      animationName: "spin",
      effect: { getComputedTiming: () => ({ endTime: 100 }), target: document.body },
    } as unknown as Animation;
    document.getAnimations = () => [animation];

    const pending = waitForPageSettle();
    const assertion = expect(pending).rejects.toThrow(/Still running:/);

    await vi.advanceTimersByTimeAsync(SETTLE_DEADLINE_MS + 50);
    await assertion;
  });
});
