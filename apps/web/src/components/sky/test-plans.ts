import { planNight } from "@cyno/engine";

export const night = planNight({
  latitude: 33.77,
  longitude: -118.19,
  date: "2026-11-17",
  timeZone: "America/Los_Angeles",
});
export const polarDay = planNight({
  latitude: 69.65,
  longitude: 18.96,
  date: "2026-06-21",
  timeZone: "Europe/Oslo",
});
