import type { BestMoment, RankFactor } from "./types";
import { degrees } from "./describe";
export const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const darknessPoints = {
  day: 0,
  "civil-twilight": 2,
  "nautical-twilight": 5,
  "astronomical-twilight": 10,
  night: 15,
};
export function rankFactors(
  best: BestMoment,
  hours: number,
  marginWithoutMoon: number,
  moonSeparation: number | null,
  illumination: number,
  clock: (time: string) => string,
): RankFactor[] {
  const brightness = 35 * clamp(marginWithoutMoon / 5);
  const moon = moonSeparation === null ? 0 : 35 * clamp(best.marginMag / 5) - brightness;
  const factors: RankFactor[] = [
    {
      key: "altitude",
      label: "Altitude",
      value: `${degrees(best.altDeg)} up at ${clock(best.time)}.`,
      points: 30 * clamp((best.altDeg - 10) / 50),
      detail: "Higher objects shine through less air.",
    },
    {
      key: "brightness",
      label: "Brightness",
      value: `${marginWithoutMoon.toFixed(1)} magnitudes above the moonless limit.`,
      points: brightness,
      detail: "A larger brightness margin makes an object easier to see.",
    },
    {
      key: "moon",
      label: "Moon",
      value: moonSeparation === null ? "The Moon itself." : `${degrees(moonSeparation)} from the Moon.`,
      points: moon,
      detail:
        moonSeparation === null
          ? "The Moon does not interfere with itself."
          : `The ${Math.round(illumination * 100)}% Moon, ${degrees(moonSeparation)} away, ${moon < 0 ? "brightens the sky around it" : "does not reduce these brightness points"}.`,
    },
    {
      key: "duration",
      label: "Duration",
      value: `Visible for ${hours.toFixed(1)} hours.`,
      points: 20 * clamp(hours / 4),
      detail: "More viewing time gives you more chances to observe.",
    },
    {
      key: "darkness",
      label: "Darkness",
      value:
        best.darkness === "night"
          ? "The sky is fully dark."
          : `The sky is in ${best.darkness.replaceAll("-", " ")}.`,
      points: darknessPoints[best.darkness],
      detail: "Darker skies reveal fainter objects.",
    },
  ];
  const subtotal = factors.reduce((s, f) => s + f.points, 0);
  factors.push({
    key: "clouds",
    label: "Clouds",
    value: best.cloudPercent === null ? "No forecast." : `${Math.round(best.cloudPercent)}% cloud cover.`,
    points: (-subtotal * (best.cloudPercent ?? 0)) / 100,
    detail:
      best.cloudPercent === null ? "Cloud cover is unknown." : "Clouds reduce your chances of a clear view.",
  });
  return factors;
}
