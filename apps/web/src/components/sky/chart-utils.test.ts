import { describe, expect, it } from "vitest";
import { clock, nearest, trackPath, zoneLabel } from "./chart-utils";
import { project } from "./projection";

describe("clock", () => {
  it("rounds times to the nearest minute before formatting", () => {
    expect(clock("UTC").format(new Date("2026-11-17T18:14:51Z"))).toBe("18:15");
  });
});

describe("zoneLabel", () => {
  it("turns the IANA zone location into a readable time label", () => {
    expect(zoneLabel("America/Los_Angeles")).toBe("Los Angeles time");
  });
});

describe("track sampling", () => {
  it("chooses the closest sample, using the earlier sample for a tie", () => {
    const samples = [{ time: "2026-11-18T05:00:00Z" }, { time: "2026-11-18T05:10:00Z" }];
    expect(nearest(samples, Date.parse("2026-11-18T05:06:00Z"))).toBe(samples[1]);
    expect(nearest(samples, Date.parse("2026-11-18T05:05:00Z"))).toBe(samples[0]);
    expect(nearest([], Date.parse("2026-11-18T05:00:00Z"))).toBeUndefined();
  });
  it("does not connect a track across the below-horizon part of the night", () => {
    const points = [
      { time: "2026-11-17T20:00:00Z", altDeg: 10, azDeg: 90 },
      { time: "2026-11-17T21:00:00Z", altDeg: -10, azDeg: 90 },
      { time: "2026-11-18T06:00:00Z", altDeg: 10, azDeg: 270 },
      { time: "2026-11-18T07:00:00Z", altDeg: 20, azDeg: 270 },
    ];
    const path = trackPath(points, (point) => project(point.altDeg, point.azDeg, 200));
    expect(path.match(/M/g)).toHaveLength(2);
    expect(path.match(/L/g)).toHaveLength(1);
    expect(path).not.toContain("NaN");
  });
});
