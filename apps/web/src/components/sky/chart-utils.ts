import type { TrackPoint } from "@cyno/engine";

export function nearest<T extends { time: string }>(samples: readonly T[], time: number): T | undefined {
  return samples.reduce<T | undefined>(
    (best, sample) =>
      !best || Math.abs(Date.parse(sample.time) - time) < Math.abs(Date.parse(best.time) - time)
        ? sample
        : best,
    undefined,
  );
}

/** Start a new subpath after every below-horizon sample. */
export function trackPath(
  points: readonly TrackPoint[],
  position: (point: TrackPoint) => { x: number; y: number } | null,
) {
  let drawing = false;
  return points
    .map((point) => {
      const projected = position(point);
      if (!projected) {
        drawing = false;
        return "";
      }
      const command = drawing ? "L" : "M";
      drawing = true;
      return `${command}${projected.x.toFixed(2)},${projected.y.toFixed(2)}`;
    })
    .join(" ");
}

export function clock(timeZone: string, hourOnly = false) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    ...(hourOnly ? {} : { minute: "2-digit" }),
    hourCycle: "h23",
  });
  return {
    format(value: Date | number) {
      const instant = value instanceof Date ? value.getTime() : value;
      return formatter.format(new Date(Math.round(instant / 60_000) * 60_000));
    },
  };
}

export function zoneLabel(timeZone: string) {
  const location = timeZone.split("/").at(-1) ?? timeZone;
  return `${location.replaceAll("_", " ")} time`;
}

export const colors = {
  abyss: "var(--color-abyss, #050816)",
  nautical: "var(--color-nautical, #13204A)",
  civil: "var(--color-civil, #34508F)",
  horizon: "var(--color-horizon, #F2B880)",
  starlight: "var(--color-starlight, #F4EFE2)",
  moonsilver: "var(--color-moonsilver, #AEB8D6)",
  signal: "var(--color-signal, #8EA7FF)",
};
