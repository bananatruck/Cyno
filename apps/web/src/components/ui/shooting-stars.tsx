// Source: https://ui.aceternity.com/registry/shooting-stars.json (https://ui.aceternity.com/components/shooting-stars-and-stars-background)
// License: Aceternity UI licence (https://ui.aceternity.com/licence); allows use in end products, not redistribution as a component.
import React, { useEffect, useId, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

interface ShootingStar {
  id: number;
  x: number;
  y: number;
  angle: number;
  scale: number;
  speed: number;
  distance: number;
}

export interface ShootingStarsProps {
  minSpeed?: number;
  maxSpeed?: number;
  minDelay?: number;
  maxDelay?: number;
  starColor?: string;
  trailColor?: string;
  starWidth?: number;
  starHeight?: number;
  className?: string;
}

const getRandomStartPoint = () => {
  const width = typeof window !== "undefined" ? window.innerWidth : 1200;
  const height = typeof window !== "undefined" ? window.innerHeight : 800;
  const side = Math.floor(Math.random() * 4);
  const offset = Math.random() * (side % 2 === 0 ? width : height);

  switch (side) {
    case 0:
      return { x: offset, y: 0, angle: 45 };
    case 1:
      return { x: width, y: offset, angle: 135 };
    case 2:
      return { x: offset, y: height, angle: 225 };
    case 3:
      return { x: 0, y: offset, angle: 315 };
    default:
      return { x: 0, y: 0, angle: 45 };
  }
};

export const ShootingStars: React.FC<ShootingStarsProps> = ({
  minSpeed = 12,
  maxSpeed = 26,
  minDelay = 2800,
  maxDelay = 6200,
  starColor = "var(--color-starlight)",
  trailColor = "var(--color-signal)",
  starWidth = 12,
  starHeight = 1.2,
  className,
}) => {
  const [star, setStar] = useState<ShootingStar | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const gradientId = useId();

  useEffect(() => {
    if (reducedMotion) return;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const createStar = () => {
      const { x, y, angle } = getRandomStartPoint();
      const newStar: ShootingStar = {
        id: Date.now(),
        x,
        y,
        angle,
        scale: 1,
        speed: Math.random() * (maxSpeed - minSpeed) + minSpeed,
        distance: 0,
      };
      setStar(newStar);
      const randomDelay = Math.random() * (maxDelay - minDelay) + minDelay;
      timerId = setTimeout(createStar, randomDelay);
    };

    timerId = setTimeout(createStar, minDelay);
    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [minSpeed, maxSpeed, minDelay, maxDelay, reducedMotion]);

  useEffect(() => {
    if (reducedMotion || !star) return;
    const moveStar = () => {
      setStar((prevStar) => {
        if (!prevStar) return null;
        const newX = prevStar.x + prevStar.speed * Math.cos((prevStar.angle * Math.PI) / 180);
        const newY = prevStar.y + prevStar.speed * Math.sin((prevStar.angle * Math.PI) / 180);
        const newDistance = prevStar.distance + prevStar.speed;
        const newScale = 1 + newDistance / 100;
        if (newX < -20 || newX > window.innerWidth + 20 || newY < -20 || newY > window.innerHeight + 20) {
          return null;
        }
        return {
          ...prevStar,
          x: newX,
          y: newY,
          distance: newDistance,
          scale: newScale,
        };
      });
    };

    const animationFrame = requestAnimationFrame(moveStar);
    return () => cancelAnimationFrame(animationFrame);
  }, [star, reducedMotion]);

  if (reducedMotion) return null;

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      className={cn("pointer-events-none fixed inset-0 h-full w-full", className)}
    >
      {star && (
        <rect
          key={star.id}
          x={star.x}
          y={star.y}
          width={starWidth * star.scale}
          height={starHeight}
          fill={`url(#${gradientId})`}
          transform={`rotate(${star.angle}, ${star.x + (starWidth * star.scale) / 2}, ${star.y + starHeight / 2})`}
        />
      )}
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: trailColor, stopOpacity: 0 }} />
          <stop offset="100%" style={{ stopColor: starColor, stopOpacity: 0.85 }} />
        </linearGradient>
      </defs>
    </svg>
  );
};
