// Source: https://ui.aceternity.com/registry/stars-background.json (https://ui.aceternity.com/components/shooting-stars-and-stars-background)
// License: Aceternity UI licence (https://ui.aceternity.com/licence); allows use in end products, not redistribution as a component.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

interface StarProps {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  twinkleSpeed: number | null;
}

export interface StarsBackgroundProps {
  starDensity?: number;
  allStarsTwinkle?: boolean;
  twinkleProbability?: number;
  minTwinkleSpeed?: number;
  maxTwinkleSpeed?: number;
  className?: string;
}

export const StarsBackground: React.FC<StarsBackgroundProps> = ({
  starDensity = 0.00011,
  allStarsTwinkle = true,
  twinkleProbability = 0.65,
  minTwinkleSpeed = 0.6,
  maxTwinkleSpeed = 1.4,
  className,
}) => {
  const [stars, setStars] = useState<StarProps[]>([]);
  const reducedMotion = usePrefersReducedMotion();
  const [redMode, setRedMode] = useState(
    () => typeof document !== "undefined" && document.documentElement.getAttribute("data-mode") === "red",
  );
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const generateStars = useCallback(
    (width: number, height: number): StarProps[] => {
      const area = width * height;
      const numStars = Math.floor(area * starDensity);
      return Array.from({ length: numStars }, () => {
        const shouldTwinkle = allStarsTwinkle || Math.random() < twinkleProbability;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * 0.45 + 0.45,
          opacity: Math.random() * 0.45 + 0.25,
          twinkleSpeed: shouldTwinkle
            ? minTwinkleSpeed + Math.random() * (maxTwinkleSpeed - minTwinkleSpeed)
            : null,
        };
      });
    },
    [starDensity, allStarsTwinkle, twinkleProbability, minTwinkleSpeed, maxTwinkleSpeed],
  );

  useEffect(() => {
    const updateStars = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width || window.innerWidth;
      const height = rect.height || window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      setStars(generateStars(width, height));
    };

    updateStars();
    if (typeof ResizeObserver === "undefined") return;
    const resizeObserver = new ResizeObserver(updateStars);
    const currentCanvas = canvasRef.current;
    if (currentCanvas) {
      resizeObserver.observe(currentCanvas);
    }
    return () => {
      if (currentCanvas) {
        resizeObserver.unobserve(currentCanvas);
      }
      resizeObserver.disconnect();
    };
  }, [generateStars]);

  useEffect(() => {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setRedMode(root.getAttribute("data-mode") === "red");
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-mode"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      ctx = null;
    }
    if (!ctx) return;

    let animationFrameId = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const rgb = redMode ? "255, 90, 78" : "244, 239, 226";
      for (const star of stars) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, ${star.opacity.toFixed(3)})`;
        ctx.fill();

        if (!reducedMotion && star.twinkleSpeed !== null) {
          star.opacity = 0.25 + Math.abs(Math.sin((Date.now() * 0.001) / star.twinkleSpeed) * 0.5);
        }
      }
      if (!reducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [stars, reducedMotion, redMode]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("pointer-events-none fixed inset-0 h-full w-full", className)}
    />
  );
};
