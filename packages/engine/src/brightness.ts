import type { Equipment, ObjectKind, SkyQuality } from "./types";
const k = 0.25;
const radians = Math.PI / 180;
export const skyBrightness = { city: 18, suburban: 19.5, rural: 21, dark: 21.7 };
export const equipmentGain = { eye: 0, binoculars: 3, telescope: 5.5 };
/** KS91 equation 3, scattering air mass. */
export function airmass(alt: number): number {
  return 1 / Math.sqrt(1 - 0.96 * Math.cos(alt * radians) ** 2);
}
const toFlux = (mag: number) => 34.08 * Math.exp(20.7233 - 0.92104 * mag);
const fromFlux = (flux: number) => (20.7233 - Math.log(flux / 34.08)) / 0.92104;
/** Krisciunas and Schaefer 1991, equations 1, 3, 15, 20 and 21.
 * https://articles.adsabs.harvard.edu/pdf/1991PASP..103.1033K
 * Equation 19 supplies the aureole within 10°. At exact alignment, machine
 * epsilon keeps the point-source approximation finite. The Moon skips this model.
 */
export function moonFlux(alt: number, moonAlt: number, phaseAngle: number, separation: number): number {
  if (moonAlt <= 0) return 0;
  const intensity = 10 ** (-0.4 * (3.84 + 0.026 * Math.abs(phaseAngle) + 4e-9 * phaseAngle ** 4));
  const mie =
    separation < 10 ? 6.2e7 / Math.max(Number.EPSILON, separation) ** 2 : 10 ** (6.15 - separation / 40);
  const scattering = 10 ** 5.36 * (1.06 + Math.cos(separation * radians) ** 2) + mie;
  return scattering * intensity * 10 ** (-0.4 * k * airmass(moonAlt)) * (1 - 10 ** (-0.4 * k * airmass(alt)));
}
export function limitingMagnitude(
  sky: SkyQuality,
  equipment: Equipment,
  sunAlt: number,
  alt: number,
  moonAlt: number,
  phaseAngle: number,
  separation: number,
  includeMoon = true,
): number {
  let flux = toFlux(skyBrightness[sky]);
  if (sunAlt >= -18) flux += toFlux(21.7 - 0.6 * (Math.min(0, sunAlt) + 18));
  if (includeMoon) flux += moonFlux(alt, moonAlt, phaseAngle, separation);
  const brightness = fromFlux(flux);
  return 7.93 - 5 * Math.log10(10 ** (4.316 - brightness / 5) + 1) + equipmentGain[equipment];
}
const penalty: Record<ObjectKind, number> = {
  moon: 0,
  planet: 0,
  star: 0,
  "double-star": 0,
  other: 0,
  galaxy: 1.5,
  nebula: 1,
  "planetary-nebula": 0.5,
  "globular-cluster": 0.5,
  "open-cluster": 0.5,
};
export function effectiveMagnitude(mag: number, alt: number, kind: ObjectKind): number {
  return mag + k * (airmass(alt) - 1) + penalty[kind];
}
