// Source: https://21st.dev/@halaska-studio/components/segmented-control
// License: MIT (as listed on the 21st.dev component page)
import { useId } from "react";
import { m } from "motion/react";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}

const PILL_CLASS =
  "pointer-events-none absolute inset-0 -z-10 rounded-full border border-signal/45 bg-civil/60";

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const groupId = useId();
  // Read live: a layout spring already running when reduced motion turns on must stop, not settle.
  const reduceMotion = usePrefersReducedMotion();

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex items-center rounded-full border border-moonsilver/25 bg-nautical/65 p-0.5 text-[13px]",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative z-10 cursor-pointer rounded-full px-2.5 py-1 transition-colors duration-150",
              active ? "font-medium text-starlight" : "text-moonsilver hover:text-starlight",
            )}
          >
            {active &&
              (reduceMotion ? (
                <span aria-hidden="true" className={PILL_CLASS} />
              ) : (
                <m.span
                  layoutId={`segment-pill-${groupId}`}
                  aria-hidden="true"
                  className={PILL_CLASS}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              ))}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
