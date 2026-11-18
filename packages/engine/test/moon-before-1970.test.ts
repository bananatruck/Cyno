import { expect, it } from "vitest";
import { planNight } from "../src/index";
import { HOUR } from "../src/time";

it("counts pre-1970 moon-up hours from rise/set events, not epoch zero", () => {
  const input = { latitude: 80, longitude: 18.96, date: "1960-01-17", timeZone: "UTC" };
  const plan = planNight(input);
  const dark = plan.darkWindow;
  if (!dark) throw new Error("Expected dark window");
  const expected = moonUpOverlapHours(Date.parse(dark.start), Date.parse(dark.end), plan.events);
  expect(Math.abs(plan.moon.hoursUpInDarkWindow - expected) * 60).toBeLessThanOrEqual(1);
});

function moonUpOverlapHours(
  darkStart: number,
  darkEnd: number,
  events: { kind: string; time: string }[],
): number {
  const moonEvents = events
    .filter((e) => e.kind === "moonrise" || e.kind === "moonset")
    .map((e) => ({ kind: e.kind, t: Date.parse(e.time) }))
    .sort((a, b) => a.t - b.t);
  let hours = 0;
  let cursor = darkStart;
  let up = false;
  for (const event of moonEvents.filter((e) => e.t <= darkStart)) {
    if (event.kind === "moonrise") up = true;
    if (event.kind === "moonset") up = false;
  }
  for (const event of moonEvents.filter((e) => e.t > darkStart && e.t < darkEnd)) {
    if (up) hours += (event.t - cursor) / HOUR;
    up = event.kind === "moonrise";
    cursor = event.t;
  }
  if (up) hours += (darkEnd - cursor) / HOUR;
  return hours;
}
