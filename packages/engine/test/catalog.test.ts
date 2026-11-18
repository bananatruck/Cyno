import { expect, it } from "vitest";
import data from "../src/data/catalog.json";

it("includes every Messier object except the ambiguous M102", () => {
  const numbers = data.deepSky.map((row) => row.messier).sort((a, b) => a - b);
  const expected = Array.from({ length: 110 }, (_, i) => i + 1).filter((n) => n !== 102);
  expect(numbers).toEqual(expected);
  expect(data.skipped).toEqual([]);
});

it("takes M35's magnitude from NGC 2000.0, the only reachable source that gives one", () => {
  const m35 = data.deepSky.find((row) => row.messier === 35);
  expect(m35).toMatchObject({ designation: "NGC2168", kind: "open-cluster", mag: 5.1, magBand: "V" });
  expect(m35?.magSource).toBe("NGC 2000.0 (HEASARC)");
});
