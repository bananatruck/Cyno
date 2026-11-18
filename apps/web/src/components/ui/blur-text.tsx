// Adapted from React Bits (https://reactbits.dev), MIT + Commons Clause. Copyright (c) 2026 David Haz. Full notice in THIRD_PARTY_NOTICES.md at the repository root.
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export interface BlurTextProps {
  text?: string;
  delay?: number;
  className?: string;
  animateBy?: "words" | "letters";
  direction?: "top" | "bottom";
  onAnimationComplete?: () => void;
  stepDuration?: number;
  as?: "span" | "p" | "h1" | "h2";
}

export function BlurText({
  text = "",
  delay = 90,
  className = "",
  animateBy = "words",
  direction = "top",
  onAnimationComplete,
  stepDuration = 0.28,
  as: Tag = "span",
}: BlurTextProps) {
  const elements = animateBy === "words" ? text.split(" ") : text.split("");

  return (
    <Tag className={cn("inline-flex flex-wrap items-baseline", className)}>
      <span className="sr-only">{text}</span>
      {elements.map((segment, index) => (
        <span
          key={`${segment}-${index}`}
          aria-hidden="true"
          onAnimationEnd={index === elements.length - 1 ? onAnimationComplete : undefined}
          className="blur-text-segment inline-block will-change-[transform,filter,opacity]"
          style={
            {
              animationDelay: `${index * delay}ms`,
              "--blur-text-duration": `${stepDuration * 2}s`,
              "--blur-text-offset": direction === "top" ? "-10px" : "10px",
            } as CSSProperties
          }
        >
          {segment === " " ? "\u00A0" : segment}
          {animateBy === "words" && index < elements.length - 1 && "\u00A0"}
        </span>
      ))}
    </Tag>
  );
}
export default BlurText;
