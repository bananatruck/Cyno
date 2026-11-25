// Cyno's own shooting star, written for this project; MIT like the rest of Cyno (see LICENSE).
import { useEffect, useId, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

interface Streak {
  /** Head position in CSS pixels. */
  x: number;
  y: number;
  /** Direction of travel in degrees, clockwise from the positive x axis (SVG y points down). */
  angle: number;
  /** Pixels per frame. */
  speed: number;
  /** Trail length so far, in pixels. */
  trail: number;
}

export interface ShootingStarsProps {
  /** Pixels per frame. */
  minSpeed?: number;
  maxSpeed?: number;
  /** Pause between streaks, in milliseconds. */
  minDelay?: number;
  maxDelay?: number;
  /** Longest trail, in pixels. */
  trailLength?: number;
  className?: string;
}

/**
 * Now and then a single streak crosses the sky: it starts on the left or right edge at a random height,
 * falls at a shallow angle, and the next one waits a random pause after it leaves. Its colours follow the
 * theme, so red-light mode turns it red. With reduced motion nothing is drawn.
 */
export function ShootingStars({
  minSpeed = 9,
  maxSpeed = 22,
  minDelay = 2500,
  maxDelay = 7000,
  trailLength = 90,
  className,
}: ShootingStarsProps) {
  const reducedMotion = usePrefersReducedMotion();
  const gradientId = useId();
  const [streak, setStreak] = useState<Streak | null>(null);

  useEffect(() => {
    if (reducedMotion) {
      setStreak(null);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame: number | undefined;
    const pause = () => (maxDelay > minDelay ? minDelay + Math.random() * (maxDelay - minDelay) : minDelay);

    const launch = () => {
      const fromRight = Math.random() < 0.5;
      const y = Math.random() * window.innerHeight;
      const tilt = 12 + Math.random() * 28;
      let current: Streak = {
        x: fromRight ? window.innerWidth : 0,
        y,
        angle: fromRight ? 180 - tilt : tilt,
        speed: minSpeed + Math.random() * (maxSpeed - minSpeed),
        trail: 0,
      };
      setStreak(current);
      const step = () => {
        const radians = (current.angle * Math.PI) / 180;
        current = {
          ...current,
          x: current.x + current.speed * Math.cos(radians),
          y: current.y + current.speed * Math.sin(radians),
          trail: Math.min(trailLength, current.trail + current.speed),
        };
        const margin = trailLength;
        const gone =
          current.x < -margin ||
          current.x > window.innerWidth + margin ||
          current.y > window.innerHeight + margin;
        if (gone) {
          setStreak(null);
          timer = setTimeout(launch, pause());
          return;
        }
        setStreak(current);
        frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };

    timer = setTimeout(launch, pause());
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [reducedMotion, minSpeed, maxSpeed, minDelay, maxDelay, trailLength]);

  if (reducedMotion) return null;
  return (
    <svg aria-hidden="true" className={cn("pointer-events-none fixed inset-0 h-full w-full", className)}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--color-starlight)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--color-signal)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {streak && (
        // The rect starts at the head and points back along the path, so the trail fades behind it.
        <rect
          x={streak.x}
          y={streak.y}
          width={Math.max(1, streak.trail)}
          height={1.5}
          rx={0.75}
          fill={`url(#${gradientId})`}
          transform={`rotate(${streak.angle + 180} ${streak.x} ${streak.y})`}
        />
      )}
    </svg>
  );
}
