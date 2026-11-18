// Stub with the final props; replaced by the real chart.
import type { NightPlan } from "@cyno/engine";

export interface SkyChartProps {
  plan: NightPlan;
  time: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

export function SkyChart({ className }: SkyChartProps) {
  return <div className={className} data-stub="sky-chart" />;
}
