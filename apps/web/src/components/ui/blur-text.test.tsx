import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BlurText } from "./blur-text";

afterEach(() => {
  cleanup();
});

describe("BlurText accessibility", () => {
  it("exposes the full word to assistive tech and hides animated letter spans", () => {
    const { container } = render(<BlurText text="Marginal" animateBy="letters" delay={0} />);
    expect(screen.getByText("Marginal")).toBeTruthy();

    const letterSpans = container.querySelectorAll('[aria-hidden="true"]');
    expect(letterSpans.length).toBe("Marginal".length);
    for (const span of letterSpans) {
      expect(span.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("exposes full verdict words used in the banner", () => {
    render(<BlurText text="Go" animateBy="letters" delay={0} />);
    expect(screen.getByText("Go")).toBeTruthy();
  });
});
