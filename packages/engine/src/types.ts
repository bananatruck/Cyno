/**
 * Public contract of @cyno/engine.
 * The web app depends only on these types and on the functions exported from index.ts.
 * All times are ISO 8601 strings in UTC (e.g. "2026-11-18T05:00:00.000Z").
 * All angles are degrees. Altitudes are geometric (airless): no atmospheric refraction is applied.
 */

/** What the observer looks through. Each step adds a fixed limiting-magnitude gain (see SPEC.md). */
export type Equipment = "eye" | "binoculars" | "telescope";

/** Light pollution at the site, as a zenith sky brightness preset (see SPEC.md). */
export type SkyQuality = "city" | "suburban" | "rural" | "dark";

export type ObjectKind =
  | "moon"
  | "planet"
  | "star"
  | "open-cluster"
  | "globular-cluster"
  | "nebula"
  | "planetary-nebula"
  | "galaxy"
  | "double-star"
  | "other";

/**
 * How dark the sky is, from the Sun's geometric altitude h:
 * day: h >= -0.833; civil-twilight: -6 <= h < -0.833; nautical-twilight: -12 <= h < -6;
 * astronomical-twilight: -18 <= h < -12; night: h < -18.
 */
export type Darkness = "day" | "civil-twilight" | "nautical-twilight" | "astronomical-twilight" | "night";

/** One hourly (or finer) cloud cover value, e.g. from Open-Meteo. */
export interface CloudSample {
  /** ISO UTC time the value applies from. A value applies until the next sample, for at most 1 hour. */
  time: string;
  /** Total cloud cover, 0 to 100. */
  percent: number;
}

export interface PlanInput {
  /** Degrees, -90 to 90, north positive. */
  latitude: number;
  /** Degrees, -180 to 180, east positive. */
  longitude: number;
  /** "YYYY-MM-DD": the local civil date of the evening. The night runs from local noon on this date to local noon the next day. */
  date: string;
  /** IANA time zone. Resolved offline from the coordinates when omitted. */
  timeZone?: string;
  /** Metres above sea level. Default 0. */
  elevationMeters?: number;
  /** Default "eye". */
  equipment?: Equipment;
  /** Default "suburban". */
  sky?: SkyQuality;
  /** Optional forecast. When absent, cloud cover is treated as unknown, never as clear. */
  cloudCover?: CloudSample[];
  /** Sampling step in minutes, 1 to 60. Default 10. */
  stepMinutes?: number;
}

/** PlanInput with every default filled in. */
export interface ResolvedInput {
  latitude: number;
  longitude: number;
  date: string;
  timeZone: string;
  elevationMeters: number;
  equipment: Equipment;
  sky: SkyQuality;
  cloudCover: CloudSample[] | null;
  stepMinutes: number;
}

export interface InputError {
  field: keyof PlanInput | "input";
  message: string;
}

export type ParseResult = { ok: true; value: PlanInput } | { ok: false; errors: InputError[] };

export type SkyEventKind =
  | "sunset"
  | "civil-dusk"
  | "nautical-dusk"
  | "astronomical-dusk"
  | "astronomical-dawn"
  | "nautical-dawn"
  | "civil-dawn"
  | "sunrise"
  | "moonrise"
  | "moonset";

export interface SkyEvent {
  kind: SkyEventKind;
  time: string;
}

/**
 * The kind of night this is at this place and date.
 * normal: the Sun goes below -18 degrees.
 * no-astronomical-darkness: the Sun sets but stays above -18 degrees.
 * no-nautical-darkness: the Sun sets but stays above -12 degrees.
 * white-night: the Sun sets but stays above -6 degrees.
 * polar-day: the Sun never sets inside the window.
 * polar-night: the Sun never rises inside the window.
 */
export type NightCondition =
  | "normal"
  | "no-astronomical-darkness"
  | "no-nautical-darkness"
  | "white-night"
  | "polar-day"
  | "polar-night";

/** The longest continuous stretch at the darkest level reached tonight. */
export interface DarkWindow {
  start: string;
  end: string;
  /** The darkest level reached: "night" when the Sun gets below -18 degrees. */
  level: Exclude<Darkness, "day">;
  hours: number;
}

export interface MoonInfo {
  /** Illuminated fraction 0 to 1, at the middle of the dark window (or of the night window if there is none). */
  illumination: number;
  /** Sun-Moon-Earth phase angle in degrees at the same instant. */
  phaseAngleDeg: number;
  /** "New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous", "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent". */
  phaseName: string;
  /** Hours the Moon is above the horizon during the dark window. 0 when there is no dark window. */
  hoursUpInDarkWindow: number;
}

export interface TimelineSample {
  time: string;
  sunAltDeg: number;
  moonAltDeg: number;
  darkness: Darkness;
  /** Cloud cover in force at this time, or null when unknown. */
  cloudPercent: number | null;
  /** Naked-eye-equivalent limiting magnitude at the zenith for the chosen sky and equipment, including twilight and moonlight. Null in daytime. */
  zenithLimitingMag: number | null;
}

export interface TrackPoint {
  time: string;
  altDeg: number;
  azDeg: number;
}

export type RankFactorKey = "altitude" | "brightness" | "moon" | "duration" | "darkness" | "clouds";

/** One line of the reasoning. The points of all factors of an object add up to its score (before rounding). */
export interface RankFactor {
  key: RankFactorKey;
  /** Short label, e.g. "Altitude". */
  label: string;
  /** The measured value in plain words, e.g. "52 degrees at 21:40". */
  value: string;
  /** Contribution to the score. Moon and clouds are zero or negative. */
  points: number;
  /** One sentence that explains the contribution. */
  detail: string;
}

export interface BestMoment {
  time: string;
  altDeg: number;
  azDeg: number;
  /** Limiting magnitude at the object's position at this time, for the chosen sky and equipment. */
  limitingMag: number;
  /** Object's magnitude after atmospheric extinction and the diffuse-object penalty. */
  effectiveMag: number;
  /** limitingMag - effectiveMag. Positive means visible. */
  marginMag: number;
  /** Cloud cover in force at this time, or null when unknown. */
  cloudPercent: number | null;
  darkness: Darkness;
}

export interface RankedObject {
  id: string;
  name: string;
  kind: ObjectKind;
  /** 1 = best. */
  rank: number;
  /** 0 to 100, rounded to one decimal. */
  score: number;
  /** Catalog or computed apparent magnitude (V, or B where the catalog has no V). */
  magnitude: number;
  constellation: string | null;
  best: BestMoment;
  /** First and last visible sample tonight. */
  visibleFrom: string;
  visibleTo: string;
  hoursVisible: number;
  peakAltDeg: number;
  /** Angular distance to the Moon at the best moment. Null for the Moon itself. */
  moonSeparationDeg: number | null;
  factors: RankFactor[];
  /** One plain sentence, e.g. "Best at 21:40, 52 degrees up in the southwest." Times are in the plan's time zone. */
  summary: string;
  /** Position at every sample of the night window, including below the horizon. */
  track: TrackPoint[];
}

export interface HiddenObject {
  id: string;
  name: string;
  kind: ObjectKind;
  /** Why it is not on the list tonight, in one plain sentence. */
  reason: string;
}

export type VerdictLabel = "go" | "marginal" | "no-go";

export interface Verdict {
  label: VerdictLabel;
  /** 0 to 100. */
  score: number;
  /** Plain sentences, most important first. */
  reasons: string[];
}

export interface NightPlan {
  input: ResolvedInput;
  /** Local noon on input.date to local noon the next day, in UTC. */
  window: { start: string; end: string };
  condition: NightCondition;
  darkWindow: DarkWindow | null;
  events: SkyEvent[];
  moon: MoonInfo;
  timeline: TimelineSample[];
  verdict: Verdict;
  /** Visible objects, best first. Empty when nothing is visible. */
  objects: RankedObject[];
  /** Catalog objects that are not visible tonight, with the reason. */
  hidden: HiddenObject[];
}
