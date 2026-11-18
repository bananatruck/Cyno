// Stub with the final props; replaced by the real timeline.
import type { NightPlan } from "@cyno/engine";

export interface NightTimelineProps {
  plan: NightPlan;
  time: string;
  onTimeChange: (iso: string) => void;
  selectedId: string | null;
  className?: string;
}

export function NightTimeline({ className }: NightTimelineProps) {
  return <div className={className} data-stub="night-timeline" />;
}
