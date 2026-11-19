/** Browser-side settle helper for Playwright `page.evaluate`. */

export const SETTLE_DEADLINE_MS = 5_000;

function labelAnimation(animation: Animation): string {
  const typed = animation as Animation & { animationName?: string; transitionProperty?: string };
  if (typed.animationName) {
    return `animation ${typed.animationName}`;
  }
  if (typed.transitionProperty) {
    return `transition ${typed.transitionProperty}`;
  }
  return "script animation";
}

export function describeRunningAnimations(): string[] {
  return document
    .getAnimations()
    .filter((animation) => animation.playState === "running")
    .map((animation) => {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      return `${labelAnimation(animation)} on ${target?.tagName.toLowerCase()}.${target?.getAttribute("class") ?? ""}`;
    });
}

export function buildSettleTimeoutMessage(deadlineMs = SETTLE_DEADLINE_MS): string {
  const running = describeRunningAnimations();
  return (
    `The page did not settle within ${deadlineMs} ms. ` +
    `Font loading: ${document.fonts.status}. ` +
    `Still running: ${running.length ? running.join("; ") : "none"}`
  );
}

/** Must stay self-contained: Playwright `page.evaluate` only serializes this function body. */
export async function waitForPageSettle(): Promise<void> {
  const deadlineMs = 5_000;
  // performance.now(), not Date.now(): the e2e tests fix the browser clock with page.clock.setFixedTime,
  // which freezes Date.now() but leaves performance.now() and timers running.
  const deadline = performance.now() + deadlineMs;

  const pageAnimationsAreIdle = () =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== "running" || animation.effect?.getComputedTiming().endTime === Infinity,
      );

  const pageLabelAnimation = (animation: Animation) => {
    const typed = animation as Animation & { animationName?: string; transitionProperty?: string };
    if (typed.animationName) {
      return `animation ${typed.animationName}`;
    }
    if (typed.transitionProperty) {
      return `transition ${typed.transitionProperty}`;
    }
    return "script animation";
  };

  const pageDescribeRunningAnimations = () =>
    document
      .getAnimations()
      .filter((animation) => animation.playState === "running")
      .map((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        return `${pageLabelAnimation(animation)} on ${target?.tagName.toLowerCase()}.${target?.getAttribute("class") ?? ""}`;
      });

  while (performance.now() < deadline) {
    if (document.fonts.status === "loaded" && pageAnimationsAreIdle()) {
      return;
    }
    const remaining = deadline - performance.now();
    if (remaining <= 0) {
      break;
    }
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, Math.min(50, remaining));
    });
  }

  if (document.fonts.status === "loaded" && pageAnimationsAreIdle()) {
    return;
  }

  const running = pageDescribeRunningAnimations();
  throw new Error(
    `The page did not settle within ${deadlineMs} ms. ` +
      `Font loading: ${document.fonts.status}. ` +
      `Still running: ${running.length ? running.join("; ") : "none"}`,
  );
}
