import { Body, Illumination, MakeTime, Observer, Rotation_EQJ_HOR } from "astronomy-engine";
import type { HiddenObject, NightPlan, PlanInput, RankedObject } from "./types";
import { resolveInput } from "./input";
import { bodies, catalog, bodyPosition } from "./positions";
import { clockFormatter, cloudAt, HOUR, nightWindow } from "./time";
import { darkness, moonInfo, nightDarkness, skyEvents } from "./sky";
import { limitingMagnitude } from "./brightness";
import { evaluateTarget } from "./evaluate";
import { verdict } from "./verdict";
export type * from "./types";
export { parsePlanInput, PlanInputError, resolveTimeZone } from "./input";
export { catalog } from "./positions";

export function planNight(input: PlanInput): NightPlan {
  const resolved = resolveInput(input);
  const observer = new Observer(resolved.latitude, resolved.longitude, resolved.elevationMeters);
  const window = nightWindow(resolved.date, resolved.timeZone);
  const start = Date.parse(window.start),
    end = Date.parse(window.end);
  const clock = clockFormatter(resolved.timeZone);
  const events = skyEvents(observer, start, end);
  const { condition, darkWindow } = nightDarkness(observer, start, end, events);
  const moon = moonInfo(observer, start, end, darkWindow);
  const step = resolved.stepMinutes * 60000;
  const samples = [];
  for (let t = start; ; t = Math.min(end, t + step)) {
    const time = MakeTime(new Date(t));
    const sun = bodyPosition(Body.Sun, time, observer);
    const moonPosition = bodyPosition(Body.Moon, time, observer);
    const illumination = Illumination(Body.Moon, time);
    samples.push({
      time,
      iso: time.date.toISOString(),
      sun,
      moon: moonPosition,
      illumination,
      rotation: Rotation_EQJ_HOR(time, observer),
      cloud: cloudAt(t, resolved.cloudCover),
      duration: Math.min(step, end - t) / HOUR,
    });
    if (t === end) break;
  }
  const lowestSunAltDeg = Math.min(...samples.map((s) => s.sun.altDeg));
  const skyGetsDark = samples.some((s) => s.sun.altDeg < -0.833);
  const timeline = samples.map((s) => ({
    time: s.iso,
    sunAltDeg: s.sun.altDeg,
    moonAltDeg: s.moon.altDeg,
    darkness: darkness(s.sun.altDeg),
    cloudPercent: s.cloud,
    zenithLimitingMag:
      s.sun.altDeg >= -0.833
        ? null
        : limitingMagnitude(
            resolved.sky,
            resolved.equipment,
            s.sun.altDeg,
            90,
            s.moon.altDeg,
            s.illumination.phase_angle,
            90 - s.moon.altDeg,
          ),
  }));
  const targets = [
    ...bodies.map((body) => ({
      id: body.toLowerCase(),
      name: String(body),
      kind: body === Body.Moon ? ("moon" as const) : ("planet" as const),
      constellation: null,
      source: { body },
    })),
    ...catalog.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      constellation: row.constellation,
      source: { row },
    })),
  ];
  const objects: RankedObject[] = [],
    hidden: HiddenObject[] = [];
  for (const target of targets) {
    const result = evaluateTarget(target, samples, observer, resolved, clock, skyGetsDark);
    if ("reason" in result) hidden.push(result);
    else objects.push(result);
  }
  objects.sort(
    (a, b) => b.score - a.score || b.best.marginMag - a.best.marginMag || a.name.localeCompare(b.name),
  );
  objects.forEach((o, i) => {
    o.rank = i + 1;
  });
  return {
    input: resolved,
    window,
    condition,
    darkWindow,
    events,
    moon,
    timeline,
    verdict: verdict(resolved, condition, darkWindow, moon, clock, lowestSunAltDeg),
    objects,
    hidden,
  };
}
