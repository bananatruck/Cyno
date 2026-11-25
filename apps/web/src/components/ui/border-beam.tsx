// Source: https://magicui.design/r/border-beam.json (https://magicui.design/docs/components/border-beam)
// License: MIT, Copyright (c) Magic UI. See THIRD_PARTY_NOTICES.md.
import type React from "react";
import { m, type MotionStyle, type Transition } from "motion/react";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

export interface BorderBeamProps {
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  transition?: Transition;
  className?: string;
  style?: React.CSSProperties;
  reverse?: boolean;
  initialOffset?: number;
  borderWidth?: number;
}

export const BorderBeam = ({
  className,
  size = 64,
  delay = 0,
  duration = 8,
  colorFrom = "var(--color-signal)",
  colorTo = "var(--color-horizon)",
  transition,
  style,
  reverse = false,
  initialOffset = 0,
  borderWidth = 1.5,
}: BorderBeamProps) => {
  // Decorative and endless: with reduced motion the beam stays still. An endless animation would also
  // keep starting style transitions every frame, so the page would never become idle.
  const reduceMotion = usePrefersReducedMotion();
  return (
    <div
      aria-hidden="true"
      // Two opaque layers, one clipped to the padding box and one to the border box, combined with
      // exclude: only the border band stays opaque, so the beam shows there and nowhere inside. An
      // intersect with a transparent layer is transparent by the CSS masking spec, even where one
      // engine happens to paint it. The smoke test compares rendered pixels of that band.
      className="pointer-events-none absolute inset-0 rounded-[inherit] border-(length:--border-beam-width) border-transparent mask-[linear-gradient(#000,#000),linear-gradient(#000,#000)] mask-exclude [mask-clip:padding-box,border-box]"
      style={
        {
          "--border-beam-width": `${borderWidth}px`,
        } as React.CSSProperties
      }
    >
      <m.div
        data-border-beam=""
        data-motion={reduceMotion ? "static" : "animated"}
        className={cn(
          "absolute aspect-square",
          "bg-linear-to-l from-(--color-from) via-(--color-to) to-transparent",
          className,
        )}
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            "--color-from": colorFrom,
            "--color-to": colorTo,
            ...style,
          } as MotionStyle
        }
        initial={{ offsetDistance: `${initialOffset}%` }}
        animate={
          reduceMotion
            ? { offsetDistance: `${initialOffset}%` }
            : {
                offsetDistance: reverse
                  ? [`${100 - initialOffset}%`, `${-initialOffset}%`]
                  : [`${initialOffset}%`, `${100 + initialOffset}%`],
              }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : {
                repeat: Infinity,
                ease: "linear",
                duration,
                delay: -delay,
                ...transition,
              }
        }
      />
    </div>
  );
};
