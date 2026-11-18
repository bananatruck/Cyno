import { expect, it } from "vitest";
import { planNight } from "../src/index";
import { HOUR, nightWindow } from "../src/time";

it("keeps the closing polar-noon sample out of visibility when the forecast expires", () => {
  const input = { latitude: 90, longitude: 0, date: "2026-12-23", timeZone: "UTC" };
  const window = nightWindow(input.date, input.timeZone);
  const plan = planNight({
    ...input,
    cloudCover: Array.from({ length: 24 }, (_, i) => ({
      time: new Date(Date.parse(window.start) + i * HOUR).toISOString(),
      percent: 100,
    })),
  });
  expect(plan.timeline.at(-1)?.time).toBe(window.end);
  expect(plan.timeline.at(-1)?.cloudPercent).toBeNull();
  expect(plan.objects.map((object) => ({ id: object.id, hours: object.hoursVisible }))).toEqual([]);
});
