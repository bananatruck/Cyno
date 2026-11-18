import { describe, expect, it } from "vitest";
import { project } from "./projection";

describe("project", () => {
  it("puts the zenith at the centre at every azimuth", () => {
    for (const azimuth of [0, 90, 180, 270]) {
      const point = project(90, azimuth, 200);
      expect(point?.x).toBeCloseTo(0);
      expect(point?.y).toBeCloseTo(0);
    }
  });
  it.each([
    [0, 0, -200],
    [90, -200, 0],
    [180, 0, 200],
    [270, 200, 0],
  ])("puts horizon azimuth %s in the correct direction", (azimuth, x, y) => {
    const point = project(0, azimuth, 200);
    expect(point?.x).toBeCloseTo(x);
    expect(point?.y).toBeCloseTo(y);
  });
  it("spaces altitude rings evenly", () => {
    expect(project(30, 0, 180)?.y).toBeCloseTo(-120);
    expect(project(60, 0, 180)?.y).toBeCloseTo(-60);
  });
  it("omits below-horizon positions", () => {
    expect(project(-0.01, 90, 200)).toBeNull();
    expect(project(-90, 270, 200)).toBeNull();
  });
});
