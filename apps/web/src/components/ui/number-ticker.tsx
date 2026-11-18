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
  const motionValue = useMotionValue(direction === "down" ? value : startValue);
  const springValue = useSpring(motionValue, {
    damping: 38,
    stiffness: 280,
  });
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

  useEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      if (ref.current) {
        ref.current.textContent = formatNumber(value);
      }
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    if (isInView) {
      timer = setTimeout(() => {
        motionValue.set(direction === "down" ? startValue : value);
      }, delay * 1000);
    }

    return () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [motionValue, isInView, delay, value, direction, startValue, formatNumber]);

  useEffect(
    () =>
      springValue.on("change", (latest) => {
        if (ref.current) {
          ref.current.textContent = formatNumber(latest);
        }
      }),
    [springValue, formatNumber],
  );

  return (
    <span ref={ref} className={cn("inline-block tabular-nums text-starlight", className)} {...props}>
      {formatNumber(value)}
    </span>
  );
}
