// Source: https://reactbits.dev/r/BlurText-TS-TW.json (https://reactbits.dev/text-animations/blur-text)
// License: MIT + Commons Clause (https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md); use inside an application is allowed, selling the components is not.
import { m, MotionConfig, type Easing, type Transition } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Snapshot = Record<string, string | number>;

export interface BlurTextProps {
  text?: string;
  delay?: number;
  className?: string;
  animateBy?: "words" | "letters";
  direction?: "top" | "bottom";
  threshold?: number;
  rootMargin?: string;
  animationFrom?: Snapshot;
  animationTo?: Snapshot[];
  easing?: Easing | Easing[];
  onAnimationComplete?: () => void;
  stepDuration?: number;
  as?: "span" | "p" | "h1" | "h2";
}

const buildKeyframes = (from: Snapshot, steps: Snapshot[]): Record<string, Array<string | number>> => {
  const keys = new Set<string>([...Object.keys(from), ...steps.flatMap((s) => Object.keys(s))]);
  const keyframes: Record<string, Array<string | number>> = {};
  keys.forEach((k) => {
    keyframes[k] = [from[k] ?? 0, ...steps.map((s) => s[k] ?? 0)];
  });
  return keyframes;
};

export function BlurText({
  text = "",
  delay = 90,
  className = "",
  animateBy = "words",
  direction = "top",
  threshold = 0.1,
  rootMargin = "0px",
  animationFrom,
  animationTo,
  easing = (t: number) => t,
  onAnimationComplete,
  stepDuration = 0.28,
  as: Tag = "span",
}: BlurTextProps) {
  const elements = animateBy === "words" ? text.split(" ") : text.split("");
  const [inView, setInView] = useState(true);
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  const defaultFrom = useMemo<Snapshot>(
    () =>
      direction === "top"
        ? { filter: "blur(8px)", opacity: 0, y: -10 }
        : { filter: "blur(8px)", opacity: 0, y: 10 },
    [direction],
  );

  const defaultTo = useMemo<Snapshot[]>(
    () => [
      {
        filter: "blur(3px)",
        opacity: 0.65,
        y: direction === "top" ? 2 : -2,
      },
      { filter: "blur(0px)", opacity: 1, y: 0 },
    ],
    [direction],
  );

  const fromSnapshot = animationFrom ?? defaultFrom;
  const toSnapshots = animationTo ?? defaultTo;

  const stepCount = toSnapshots.length + 1;
  const totalDuration = stepDuration * (stepCount - 1);
  const times = Array.from({ length: stepCount }, (_, i) => (stepCount === 1 ? 0 : i / (stepCount - 1)));

  return (
    <MotionConfig reducedMotion="user">
      <Tag
        ref={(node: HTMLElement | null) => {
          ref.current = node;
        }}
        className={cn("inline-flex flex-wrap items-baseline", className)}
      >
        {elements.map((segment, index) => {
          const animateKeyframes = buildKeyframes(fromSnapshot, toSnapshots);
          const spanTransition: Transition = {
            duration: totalDuration,
            times,
            delay: (index * delay) / 1000,
            ease: easing,
          };

          return (
            <m.span
              key={`${segment}-${index}`}
              initial={fromSnapshot}
              animate={inView ? animateKeyframes : fromSnapshot}
              transition={spanTransition}
              onAnimationComplete={index === elements.length - 1 ? onAnimationComplete : undefined}
              className="inline-block will-change-[transform,filter,opacity]"
            >
              {segment === " " ? "\u00A0" : segment}
              {animateBy === "words" && index < elements.length - 1 && "\u00A0"}
            </m.span>
          );
        })}
      </Tag>
    </MotionConfig>
  );
}
export default BlurText;
