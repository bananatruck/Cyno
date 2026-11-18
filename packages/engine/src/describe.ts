export function compass(az: number): string {
  return (
    ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"][
      Math.round((((az % 360) + 360) % 360) / 45) % 8
    ] ?? "north"
  );
}
export const degrees = (angle: number) => `${Math.round(angle)}°`;
export function summary(time: string, alt: number, az: number, clock: (time: string) => string): string {
  return `Best at ${clock(time)}, ${degrees(alt)} up in the ${compass(az)}.`;
}
