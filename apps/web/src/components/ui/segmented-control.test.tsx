import type { ComponentPropsWithoutRef } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return {
    ...actual,
    m: {
      span: ({
        layoutId,
        transition,
        ...props
      }: ComponentPropsWithoutRef<"span"> & { layoutId?: string; transition?: unknown }) => (
        <span data-layout-id={layoutId} data-transition={JSON.stringify(transition)} {...props} />
      ),
    },
  };
});

import { SegmentedControl } from "./segmented-control";

function mockReducedMotion(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      get matches() {
        return matches;
      },
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    })),
  );
  return (next: boolean) => {
    matches = next;
    listeners.forEach((listener) => listener());
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderControl() {
  return render(
    <SegmentedControl
      label="Quality"
      options={[
        { value: "dark", label: "Dark" },
        { value: "urban", label: "Urban" },
      ]}
      value="dark"
      onChange={vi.fn()}
    />,
  );
}

const pill = (container: HTMLElement) =>
  container.querySelector('button[aria-pressed="true"] > span[aria-hidden]');

describe("SegmentedControl", () => {
  it("animates the selection pill with a spring while motion is allowed", () => {
    mockReducedMotion(false);
    const { container } = renderControl();
    expect(pill(container)?.getAttribute("data-layout-id")).toMatch(/^segment-pill-/);
    expect(pill(container)?.getAttribute("data-transition")).toContain('"type":"spring"');
  });

  it("replaces the animated pill with a static one when reduced motion turns on", () => {
    const setReducedMotion = mockReducedMotion(false);
    const { container } = renderControl();
    act(() => setReducedMotion(true));
    expect(pill(container)).not.toBeNull();
    expect(pill(container)?.hasAttribute("data-layout-id")).toBe(false);
    expect(pill(container)?.hasAttribute("data-transition")).toBe(false);

    act(() => setReducedMotion(false));
    expect(pill(container)?.getAttribute("data-layout-id")).toMatch(/^segment-pill-/);
  });

  it("uses the static pill from the start when reduced motion is preferred", () => {
    mockReducedMotion(true);
    const { container } = renderControl();
    expect(pill(container)).not.toBeNull();
    expect(pill(container)?.hasAttribute("data-layout-id")).toBe(false);
  });
});
