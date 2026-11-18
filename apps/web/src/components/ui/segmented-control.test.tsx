import type { PropsWithChildren } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return {
    ...actual,
    MotionConfig: ({
      children,
      reducedMotion,
    }: PropsWithChildren<{ reducedMotion?: "always" | "never" | "user" }>) => (
      <div data-motion-policy={reducedMotion}>{children}</div>
    ),
  };
});

import { SegmentedControl } from "./segmented-control";

afterEach(cleanup);

describe("SegmentedControl", () => {
  it("delegates layout animation to the user's reduced-motion preference", () => {
    const { container } = render(
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

    expect(container.querySelector('[data-motion-policy="user"]')).toBeTruthy();
  });
});
