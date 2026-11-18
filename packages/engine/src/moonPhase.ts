export function moonPhaseName(phaseLongitudeDeg: number, illumination: number): string {
  const phase = ((phaseLongitudeDeg % 360) + 360) % 360;
  const near = (target: number) => {
    const delta = Math.abs(phase - target);
    return Math.min(delta, 360 - delta) <= 6;
  };
  if (near(0)) return "New Moon";
  if (near(90)) return "First Quarter";
  if (near(180)) return "Full Moon";
  if (near(270)) return "Last Quarter";
  if (phase < 180) return illumination < 0.5 ? "Waxing Crescent" : "Waxing Gibbous";
  return illumination > 0.5 ? "Waning Gibbous" : "Waning Crescent";
}
