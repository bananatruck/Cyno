// Source: https://magicui.design/r/number-ticker.json (https://magicui.design/docs/components/number-ticker)
// License: MIT
import { useCallback, useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { useMotionValue, useSpring } from "motion/react";
import { cn } from "@/lib/utils";

export interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  value: number;
  startValue?: number;
  direction?: "up" | "down";
  delay?: number;
  decimalPlaces?: number;
}

export function NumberTicker({
  value,
  startValue = 0,
  direction = "up",
  delay = 0,
  className,
  decimalPlaces = 0,
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const initiallyReduced =
    typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const initialValue = initiallyReduced ? value : direction === "down" ? value : startValue;
  const motionValue = useMotionValue(initialValue);
  const springValue = useSpring(motionValue, {
    damping: 38,
    stiffness: 280,
  });
  const [reducedMotion, setReducedMotion] = useState(initiallyReduced);
  const [isInView, setIsInView] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const formatNumber = useCallback(
    (n: number) =>
      Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(Number(n.toFixed(decimalPlaces))),
    [decimalPlaces],
  );

  const [displayedValue, setDisplayedValue] = useState(() => formatNumber(initialValue));

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(
    () => springValue.on("change", (latest) => setDisplayedValue(formatNumber(latest))),
    [springValue, formatNumber],
  );

  useEffect(() => {
    if (reducedMotion) {
      springValue.stop();
      motionValue.set(value);
      springValue.jump(value);
      return;
    }

    const start = direction === "down" ? value : startValue;
    const target = direction === "down" ? startValue : value;
    springValue.stop();
    motionValue.set(start);
    springValue.jump(start);

    let timer: ReturnType<typeof setTimeout> | null = null;
    if (isInView) {
      timer = setTimeout(() => {
        motionValue.set(target);
      }, delay * 1000);
    }

    return () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [motionValue, springValue, isInView, delay, value, direction, startValue, reducedMotion, formatNumber]);

  return (
    <span ref={ref} className={cn("inline-block tabular-nums text-starlight", className)} {...props}>
      {displayedValue}
    </span>
  );
}
