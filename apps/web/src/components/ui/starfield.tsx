// Cyno's own starfield backdrop, written for this project; MIT like the rest of Cyno (see LICENSE).
import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

interface Star {
  /** Position and radius in CSS pixels. */
  x: number;
  y: number;
  radius: number;
  /** Resting opacity. */
  brightness: number;
  /** Twinkle rate in radians per second, or null for a steady star. */
  twinkle: number | null;
  phase: number;
}

export interface StarsBackgroundProps {
  /** Stars per square CSS pixel. */
  starDensity?: number;
  /** Share of stars that twinkle, from 0 to 1. */
  twinkleShare?: number;
  className?: string;
}

/** The starlight colour of each display mode, as the RGB part of an rgba() colour. */
const STAR_RGB = { night: "244, 239, 226", red: "255, 90, 78" } as const;
/** Milliseconds the stars take to fade in after the page loads. */
const FADE_IN_MS = 1200;

/** Whether the page is in red-light mode, following the `data-mode` attribute on the root element. */
function useRedMode(): boolean {
  const read = () =>
    typeof document !== "undefined" && document.documentElement.getAttribute("data-mode") === "red";
  const [red, setRed] = useState(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setRed(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
    setRed(read());
    return () => observer.disconnect();
  }, []);
  return red;
}

function scatter(width: number, height: number, density: number, twinkleShare: number): Star[] {
  const count = Math.max(1, Math.floor(width * height * density));
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: 0.35 + Math.random() * 0.8,
    brightness: 0.3 + Math.random() * 0.55,
    twinkle: Math.random() < twinkleShare ? 0.5 + Math.random() * 1.2 : null,
    phase: Math.random() * Math.PI * 2,
  }));
}

/**
 * A field of faint stars on a full-viewport canvas behind the page. The stars fade in once and some
 * twinkle; with reduced motion they are drawn once and stay still. Switching to red-light mode redraws
 * the same stars in red.
 */
export function StarsBackground({
  starDensity = 0.00015,
  twinkleShare = 0.6,
  className,
}: StarsBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const red = useRedMode();
  const [stars, setStars] = useState<Star[]>([]);

  // Scatter stars to fit the canvas, again whenever its size changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const place = () => {
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      setStars(scatter(width, height, starDensity, twinkleShare));
    };
    place();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(place);
      observer.observe(canvas);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [starDensity, twinkleShare]);

  // Draw the stars: every frame while motion is allowed, once otherwise.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || stars.length === 0) return;
    const rgb = red ? STAR_RGB.red : STAR_RGB.night;
    const scale = window.devicePixelRatio || 1;
    const draw = (seconds: number, fade: number) => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      for (const star of stars) {
        const flicker =
          star.twinkle === null ? 1 : 0.65 + 0.35 * Math.sin(seconds * star.twinkle + star.phase);
        context.beginPath();
        context.arc(star.x * scale, star.y * scale, star.radius * scale, 0, Math.PI * 2);
        context.fillStyle = `rgba(${rgb}, ${(star.brightness * flicker * fade).toFixed(3)})`;
        context.fill();
      }
    };
    if (reducedMotion) {
      draw(0, 1);
      return;
    }
    let start: number | null = null;
    let frame = requestAnimationFrame(function tick(now) {
      start ??= now;
      draw(now / 1000, Math.min(1, (now - start) / FADE_IN_MS));
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [stars, reducedMotion, red]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("pointer-events-none fixed inset-0 h-full w-full", className)}
    />
  );
}
