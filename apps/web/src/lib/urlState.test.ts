import { describe, expect, it } from "vitest";
import { parseCoordinateText, readUrlState } from "./urlState";

const NOW = new Date("2026-11-17T20:00:00Z");

describe("parseCoordinateText", () => {
  it.each([
    ["33.77", 33.77],
    ["-118.19", -118.19],
    ["+45", 45],
    [" 12.5 ", 12.5],
    ["0", 0],
    [".5", 0.5],
    ["5.", 5],
  ])("reads the plain decimal %j", (text, expected) => {
    expect(parseCoordinateText(text)).toBe(expected);
  });

  it.each(["", "  ", "0x21", "1e1", "Infinity", "-", ".", "1,5", "12abc", "0b11"])("rejects %j", (text) => {
    expect(parseCoordinateText(text)).toBeNaN();
  });
});

describe("readUrlState", () => {
  it("uses Long Beach only when lat and lon are absent", () => {
    const state = readUrlState("", NOW);
    expect(state.latText).toBe("33.77");
    expect(state.lonText).toBe("-118.19");
    expect(state.placeName).toBe("Long Beach, CA");
    expect(state.date).toBe("2026-11-17");
  });

  it("keeps a present but empty lat or lon empty, so the field error shows", () => {
    expect(readUrlState("?lat=&lon=-118.19", NOW).latText).toBe("");
    expect(readUrlState("?lat=33.77&lon=", NOW).lonText).toBe("");
  });

  it("keeps a non-decimal coordinate as typed, so it stays invalid", () => {
    const state = readUrlState("?lat=0x21&lon=1e1", NOW);
    expect(state.latText).toBe("0x21");
    expect(state.lonText).toBe("1e1");
    expect(parseCoordinateText(state.latText)).toBeNaN();
    expect(state.placeName).not.toContain("33.00");
  });

  it.each([
    ["%2B45", "45"],
    ["5.", "5"],
    [".5", "0.5"],
    ["-.5", "-0.5"],
    ["%20%2012.50%20", "12.50"],
    ["45", "45"],
    ["-118.19", "-118.19"],
  ])("rewrites the accepted URL latitude %j as %j, which a number input can show", (raw, shown) => {
    const state = readUrlState(`?lat=${raw}&lon=20`, NOW);
    expect(state.latText).toBe(shown);
    expect(parseCoordinateText(state.latText)).toBe(parseCoordinateText(decodeURIComponent(raw)));
  });

  it("rewrites an accepted URL longitude the same way", () => {
    expect(readUrlState("?lat=10&lon=%2B20.", NOW).lonText).toBe("20");
  });

  it("names a matching preset and formats other coordinates", () => {
    expect(readUrlState("?lat=35.68&lon=139.69", NOW).placeName).toBe("Tokyo");
    expect(readUrlState("?lat=10&lon=20", NOW).placeName).toBe("10.00°, 20.00°");
    expect(readUrlState("?lat=10&lon=20&name=Home", NOW).placeName).toBe("Home");
  });

  it("reads date, sky and equipment, defaulting unknown values", () => {
    const state = readUrlState("?lat=10&lon=20&date=2026-06-21&sky=dark&eq=telescope", NOW);
    expect(state).toMatchObject({ date: "2026-06-21", sky: "dark", equipment: "telescope" });
    expect(readUrlState("?sky=space&eq=radar", NOW)).toMatchObject({ sky: "suburban", equipment: "eye" });
  });
});
