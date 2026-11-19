import { describe, expect, it } from "vitest";
import { Body, Illumination, MakeTime, Observer } from "astronomy-engine";
import { parsePlanInput, planNight, PlanInputError } from "../src/index";
import { moonInfo, MOON_RISE_SET_ALT_DEG } from "../src/sky";
import {
  addCalendarDays,
  cloudAt,
  cloudAtParsed,
  HOUR,
  localNoon,
  nightWindow,
  parseCloudCover,
} from "../src/time";
import { bodyPosition } from "../src/positions";
import { horizons } from "./helpers";

const DATE_MSG = "Enter a date between 1800-01-01 and 2200-12-31.";

describe("finding 1: circumpolar Moon when SearchRiseSet finds no crossing", () => {
  it("counts the Moon as up at the north pole on a full-Moon night", () => {
    const input = { latitude: 90, longitude: 0, date: "2026-12-23", timeZone: "UTC" };
    const plan = planNight(input);
    const observer = new Observer(90, 0, 0);
    const window = nightWindow(input.date, input.timeZone);
    const start = Date.parse(window.start);
    const end = Date.parse(window.end);
    const alt = bodyPosition(Body.Moon, MakeTime(new Date((start + end) / 2)), observer).altDeg;
    expect(alt).toBeGreaterThan(MOON_RISE_SET_ALT_DEG);
    expect(plan.darkWindow).not.toBeNull();
    const info = moonInfo(observer, start, end, plan.darkWindow);
    expect(info.hoursUpInDarkWindow).toBeGreaterThan(0);
  });
});

describe("finding 2: plan date range and safe calendar math", () => {
  it.each(["9999-12-31", "0042-06-15", "1799-12-31", "2201-01-01"])("rejects %s", (date) => {
    const result = parsePlanInput({ latitude: 0, longitude: 0, date });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContainEqual({ field: "date", message: DATE_MSG });
  });

  it("accepts 1800-01-01 and 2200-12-31", () => {
    for (const date of ["1800-01-01", "2200-12-31"])
      expect(parsePlanInput({ latitude: 0, longitude: 0, date }).ok).toBe(true);
  });

  it("adds one calendar day without ISO string slice bugs", () => {
    const w = nightWindow("2200-12-30", "UTC");
    expect(w.end.startsWith("2200-12-31")).toBe(true);
  });
});

describe("finding 3: missing local calendar dates", () => {
  it("rejects Africa/Khartoum 2000-01-15 when local noon was skipped", () => {
    expect(() =>
      planNight({ latitude: 15.5, longitude: 32.5, date: "2000-01-15", timeZone: "Africa/Khartoum" }),
    ).toThrow(PlanInputError);
    try {
      planNight({ latitude: 15.5, longitude: 32.5, date: "2000-01-15", timeZone: "Africa/Khartoum" });
    } catch (error) {
      expect(error).toBeInstanceOf(PlanInputError);
      if (error instanceof PlanInputError)
        expect(error.errors).toContainEqual({
          field: "date",
          message: "Local noon does not exist on the selected date in this time zone.",
        });
    }
  });

  it("rejects Pacific/Apia 2011-12-30", () => {
    expect(() =>
      planNight({ latitude: -13.83, longitude: -171.76, date: "2011-12-30", timeZone: "Pacific/Apia" }),
    ).toThrow(PlanInputError);
    try {
      planNight({ latitude: -13.83, longitude: -171.76, date: "2011-12-30", timeZone: "Pacific/Apia" });
    } catch (error) {
      expect(error).toBeInstanceOf(PlanInputError);
      if (error instanceof PlanInputError)
        expect(error.errors).toContainEqual({
          field: "date",
          message: "That date does not exist in this time zone.",
        });
    }
  });

  it("rejects Asia/Manila 1844-12-30 when the next calendar day was skipped", () => {
    expect(() =>
      planNight({ latitude: 14.6, longitude: 121, date: "1844-12-30", timeZone: "Asia/Manila" }),
    ).toThrow(PlanInputError);
    try {
      planNight({ latitude: 14.6, longitude: 121, date: "1844-12-30", timeZone: "Asia/Manila" });
    } catch (error) {
      expect(error).toBeInstanceOf(PlanInputError);
      if (error instanceof PlanInputError)
        expect(error.errors).toContainEqual({
          field: "date",
          message: "The next calendar day is missing or has no local noon in this time zone.",
        });
    }
  });
});

describe("finding 5: numeric offset time zones", () => {
  it("returns a field error for a non-string time zone", () => {
    const result = parsePlanInput({
      latitude: 0,
      longitude: 0,
      date: "2026-06-21",
      timeZone: { toString: null },
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors).toContainEqual({ field: "timeZone", message: "Enter a known IANA time zone." });
  });
  it.each(["+01:00", "-0530", "+0000"])("rejects offset %s", (timeZone) => {
    const result = parsePlanInput({ latitude: 0, longitude: 0, date: "2026-06-21", timeZone });
    expect(result.ok).toBe(false);
  });

  it("keeps UTC and IANA names", () => {
    expect(parsePlanInput({ latitude: 0, longitude: 0, date: "2026-06-21", timeZone: "UTC" }).ok).toBe(true);
    expect(
      parsePlanInput({
        latitude: 33.77,
        longitude: -118.19,
        date: "2026-11-17",
        timeZone: "America/Los_Angeles",
      }).ok,
    ).toBe(true);
  });
});

describe("finding 6: cloud lookup performance", () => {
  it("plans 10000 one-second cloud samples in under 2 seconds", () => {
    const base = { latitude: 69.65, longitude: 18.96, date: "2026-12-21", timeZone: "Europe/Oslo" };
    const darkPlan = planNight(base);
    const dark = darkPlan.darkWindow;
    expect(dark).not.toBeNull();
    const a = Date.parse(required(dark).start);
    const cloudCover = Array.from({ length: 10_000 }, (_, i) => ({
      time: new Date(a + i * 1000).toISOString(),
      percent: i % 100,
    }));
    const start = performance.now();
    planNight({ ...base, cloudCover, stepMinutes: 10 });
    expect(performance.now() - start).toBeLessThan(2000);
  });
});

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("required");
  return value;
}

describe("finding 7: skyGetsDark vs condition at coarse steps", () => {
  it("uses sampling-step reason when the dark window exists but no sample is dark", () => {
    const plan = planNight({
      latitude: 65.7,
      longitude: 8,
      date: "2026-06-21",
      timeZone: "UTC",
      stepMinutes: 60,
    });
    expect(plan.condition).not.toBe("polar-day");
    expect(plan.darkWindow).not.toBeNull();
    expect(plan.timeline.every((s) => s.sunAltDeg >= -0.833)).toBe(true);
    expect(plan.hidden.length).toBeGreaterThan(0);
    expect(
      plan.hidden.every((o) => o.reason === "Not dark long enough at this sampling step to check."),
    ).toBe(true);
  });
});

describe("finding 6 unit: parsed cloud cover", () => {
  it("looks up out-of-order samples by timestamp", () => {
    const samples = [
      { time: "2026-11-18T02:00:00.000Z", percent: 100 },
      { time: "2026-11-18T01:00:00.000Z", percent: 0 },
    ];
    expect(cloudAt(Date.parse("2026-11-18T01:30:00.000Z"), samples)).toBe(0);
  });

  it("returns literal percents within the hour, then null past expiry or in gaps", () => {
    const parsed = parseCloudCover([
      { time: "2026-11-18T05:00:00.000Z", percent: 80 },
      { time: "2026-11-18T08:00:00.000Z", percent: 40 },
    ]);
    expect(cloudAtParsed(Date.parse("2026-11-18T05:00:00.000Z"), parsed)).toBe(80);
    expect(cloudAtParsed(Date.parse("2026-11-18T05:59:59.999Z"), parsed)).toBe(80);
    expect(cloudAtParsed(Date.parse("2026-11-18T06:00:00.000Z"), parsed)).toBeNull();
    expect(
      cloudAt(Date.parse("2026-11-18T07:30:00.000Z"), [
        { time: "2026-11-18T05:00:00.000Z", percent: 80 },
        { time: "2026-11-18T08:00:00.000Z", percent: 40 },
      ]),
    ).toBeNull();
    expect(
      cloudAt(Date.parse("2026-11-18T08:00:00.000Z"), [
        { time: "2026-11-18T05:00:00.000Z", percent: 80 },
        { time: "2026-11-18T08:00:00.000Z", percent: 40 },
      ]),
    ).toBe(40);
    expect(
      cloudAt(Date.parse("2026-11-18T08:30:00.000Z"), [
        { time: "2026-11-18T05:00:00.000Z", percent: 80 },
        { time: "2026-11-18T08:00:00.000Z", percent: 40 },
      ]),
    ).toBe(40);
    expect(cloudAtParsed(Date.parse("2026-11-18T09:00:00.000Z"), parsed)).toBeNull();
  });
});

/** Horizons APmag tolerance documented in docs/SPEC.md (0.1 mag for positions; same allowance for magnitudes). */
const HORIZONS_MAG_TOLERANCE = 0.1;

describe("finding 9: Horizons APmag references", () => {
  for (const [file, body] of [
    ["hz_299.txt", Body.Venus],
    ["hz_499.txt", Body.Mars],
    ["hz_599.txt", Body.Jupiter],
    ["hz_699.txt", Body.Saturn],
  ] as const) {
    for (const row of horizons(file))
      it(`${body} APmag at ${row.time} matches Horizons`, () => {
        const engineMag = Illumination(body, MakeTime(new Date(row.time))).mag;
        expect(Math.abs(engineMag - row.apMag)).toBeLessThanOrEqual(HORIZONS_MAG_TOLERANCE);
      });
  }
});

describe("finding 4: read plan fields once for validation", () => {
  it("uses getter values consistently", () => {
    let reads = 0;
    const raw = {
      get latitude() {
        reads++;
        return 10;
      },
      get longitude() {
        reads++;
        return 10;
      },
      get date() {
        reads++;
        return "2026-06-21";
      },
    };
    const result = parsePlanInput(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.latitude).toBe(10);
      expect(result.value.longitude).toBe(10);
      expect(result.value.date).toBe("2026-06-21");
    }
    expect(reads).toBe(3);
  });
});

describe("finding 8: DST night window endpoints", () => {
  const zone = "America/Los_Angeles";

  function offsetHoursAt(utcMs: number): number {
    const part = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    })
      .formatToParts(utcMs)
      .find((x) => x.type === "timeZoneName")?.value;
    const m = /^GMT([+-])(\d+)(?::(\d+))?$/.exec(part ?? "");
    if (!m) return -8;
    const sign = m[1] === "-" ? -1 : 1;
    return sign * (Number(m[2]) + Number(m[3] ?? 0) / 60);
  }

  it.each([
    ["2026-03-07", 23, -8, -7],
    ["2026-10-31", 25, -7, -8],
  ] as const)("night on %s lasts %s hours", (date, hours, offsetStart, offsetEnd) => {
    const next = addCalendarDays(date, 1);
    const start = localNoon(date, zone);
    const end = localNoon(next, zone);
    expect(offsetHoursAt(start)).toBe(offsetStart);
    expect(offsetHoursAt(end)).toBe(offsetEnd);
    expect(end - start).toBe(hours * HOUR);
    const w = nightWindow(date, zone);
    expect(Date.parse(w.start)).toBe(start);
    expect(Date.parse(w.end)).toBe(end);
    if (date === "2026-03-07") {
      expect(w.start).toBe("2026-03-07T20:00:00.000Z");
      expect(w.end).toBe("2026-03-08T19:00:00.000Z");
    } else {
      expect(w.start).toBe("2026-10-31T19:00:00.000Z");
      expect(w.end).toBe("2026-11-01T20:00:00.000Z");
    }
  });
});
