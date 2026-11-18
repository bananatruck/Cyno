import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BlurText } from "./blur-text";

afterEach(() => {
  cleanup();
});

describe("BlurText accessibility", () => {
  it("exposes the full word to assistive tech and hides animated letter spans", () => {
    const { container } = render(<BlurText as="h1" text="Marginal" animateBy="letters" delay={35} />);
    expect(screen.getByRole("heading", { name: "Marginal" })).toBeTruthy();

    const letterSpans = container.querySelectorAll('[aria-hidden="true"]');
    expect(letterSpans.length).toBe("Marginal".length);
    for (const [index, span] of Array.from(letterSpans).entries()) {
      expect(span.getAttribute("aria-hidden")).toBe("true");
      expect((span as HTMLElement).style.animationDelay).toBe(`${index * 35}ms`);
    }
  });

  it("exposes full verdict words used in the banner", () => {
    render(<BlurText text="Go" animateBy="letters" delay={0} />);
    expect(screen.getByText("Go")).toBeTruthy();
  });
});
