import { expect, it } from "vitest";
import data from "../src/data/catalog.json";
import { planNight } from "../src/index";

it("includes every Messier object except the ambiguous M102", () => {
  const numbers = data.deepSky.map((row) => row.messier).sort((a, b) => a - b);
  const expected = Array.from({ length: 110 }, (_, i) => i + 1).filter((n) => n !== 102);
  expect(numbers).toEqual(expected);
  expect(data.skipped).toEqual([]);
});

it("lists IAU star Suhail (lambda Velorum) and evaluates it on a southern night", () => {
  // IAU-CSN, HR 3634
  const suhail = data.stars.find((row) => row.name === "Suhail");
  const byId = data.stars.find((row) => row.id === "star-suhail");
  expect(suhail).toEqual(byId);
  expect(suhail).toMatchObject({ kind: "star", magBand: "V", constellation: "Vel", source: "IAU-CSN" });
  const place = {
    latitude: -34,
    longitude: 151,
    date: "2026-07-15",
    timeZone: "Australia/Sydney",
  };
  const plan = planNight(place);
  const ranked =
    plan.objects.find((o) => o.id === "star-suhail") ?? plan.hidden.find((o) => o.id === "star-suhail");
  expect(ranked).toBeDefined();
});

it("takes M35's magnitude from NGC 2000.0, the only reachable source that gives one", () => {
  const m35 = data.deepSky.find((row) => row.messier === 35);
  expect(m35).toMatchObject({ designation: "NGC2168", kind: "open-cluster", mag: 5.1, magBand: "V" });
  expect(m35?.magSource).toBe("NGC 2000.0 (HEASARC)");
});
