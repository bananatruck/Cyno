import {
  Body,
  Equator,
  Horizon,
  HorizonFromVector,
  RotateVector,
  Spherical,
  VectorFromSphere,
} from "astronomy-engine";
import type { AstroTime, Observer, RotationMatrix } from "astronomy-engine";
import data from "./data/catalog.json";
import type { ObjectKind } from "./types";
export interface CatalogObject {
  id: string;
  name: string;
  kind: ObjectKind;
  raDeg: number;
  decDeg: number;
  mag: number;
  constellation: string;
}
const kinds: readonly string[] = [
  "star",
  "open-cluster",
  "globular-cluster",
  "nebula",
  "planetary-nebula",
  "galaxy",
  "double-star",
  "other",
];
function catalogEntry(row: (typeof data.stars)[number] | (typeof data.deepSky)[number]): CatalogObject {
  if (!kinds.includes(row.kind)) throw new Error("Unknown catalog kind.");
  return { ...row, kind: row.kind as ObjectKind };
}
export const catalog: readonly Readonly<CatalogObject>[] = Object.freeze(
  [...data.stars, ...data.deepSky].map((row) => Object.freeze(catalogEntry(row))),
);
export const bodies = [
  Body.Moon,
  Body.Mercury,
  Body.Venus,
  Body.Mars,
  Body.Jupiter,
  Body.Saturn,
  Body.Uranus,
  Body.Neptune,
];
export function bodyPosition(body: Body, time: AstroTime, observer: Observer) {
  const eq = Equator(body, time, observer, true, true);
  // Omitting refraction is the documented airless equivalent of null in 2.1.19.
  const hor = Horizon(time, observer, eq.ra, eq.dec);
  return { altDeg: hor.altitude, azDeg: hor.azimuth };
}
export function catalogPosition(
  row: Pick<CatalogObject, "raDeg" | "decDeg">,
  time: AstroTime,
  rotation: RotationMatrix,
) {
  const vector = VectorFromSphere(new Spherical(row.decDeg, row.raDeg, 1), time);
  const hor = HorizonFromVector(RotateVector(rotation, vector), "");
  return { altDeg: hor.lat, azDeg: hor.lon };
}
export function separation(
  a: { altDeg: number; azDeg: number },
  b: { altDeg: number; azDeg: number },
): number {
  const r = Math.PI / 180;
  return (
    Math.acos(
      Math.max(
        -1,
        Math.min(
          1,
          Math.sin(a.altDeg * r) * Math.sin(b.altDeg * r) +
            Math.cos(a.altDeg * r) * Math.cos(b.altDeg * r) * Math.cos((a.azDeg - b.azDeg) * r),
        ),
      ),
    ) / r
  );
}
