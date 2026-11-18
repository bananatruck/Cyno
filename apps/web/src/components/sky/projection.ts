/** Looking up: north is up and east is left. Below-horizon positions are absent. */
export function project(altDeg: number, azDeg: number, radius: number) {
  if (altDeg < 0) return null;
  const distance = ((90 - altDeg) / 90) * radius;
  const azimuth = (azDeg * Math.PI) / 180;
  return { x: -distance * Math.sin(azimuth), y: -distance * Math.cos(azimuth) };
}
