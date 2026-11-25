import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InputError, NightPlan, PlanInput } from "@cyno/engine";
import { parsePlanInput } from "@cyno/engine/input";
import { PlanRunner, type ComputeResult } from "./planRunner";
import { fetchCloudForecast, type ForecastStatus, type WeatherStatus } from "./weather";

export type PlanStatus = "idle" | "computing" | "ready" | "error";

/** A finished plan for an earlier input, with the place label it was computed for. */
export interface StalePlan {
  plan: NightPlan;
  label: string;
  weatherStatus: ForecastStatus;
}

export interface UsePlanResult {
  /** The plan for the current input, or null while it is computing or invalid. */
  plan: NightPlan | null;
  status: PlanStatus;
  errors: InputError[];
  isWorkerError: boolean;
  weatherStatus: ForecastStatus;
  /** While the current input computes, the last plan shown for a different input. */
  stalePlan: StalePlan | null;
  retry: () => void;
}

type ForecastRun =
  { status: "none" } | { status: "computing" } | { status: "ready"; plan: NightPlan } | { status: "failed" };

/** One computation request: an offline base plan, then optionally a forecast-enriched plan. */
interface PlanRun {
  requestKey: string;
  inputKey: string;
  label: string;
  base: ComputeResult | null;
  weather: WeatherStatus | "loading";
  forecast: ForecastRun;
}

type DisplayedRun = StalePlan & { inputKey: string };

interface PlanRunsState {
  run: PlanRun | null;
  /** What an earlier run displayed, kept so it can stand in while `run` has no plan yet. */
  previous: DisplayedRun | null;
}

function displayedPlan(run: PlanRun): NightPlan | null {
  if (run.forecast.status === "ready") return run.forecast.plan;
  return run.base?.ok ? run.base.plan : null;
}

/** The engine's sunset altitude: below it a sample counts as night for visibility. */
const SUNSET_ALT_DEG = -0.833;

/** How much of the night the forecast covers; with no night at all, how much of the window. */
function forecastCoverage(plan: NightPlan): ForecastStatus {
  const dark = plan.timeline.filter((sample) => sample.sunAltDeg < SUNSET_ALT_DEG);
  const relevant = dark.length > 0 ? dark : plan.timeline;
  const covered = relevant.filter((sample) => sample.cloudPercent !== null).length;
  if (covered === 0) return "unavailable";
  return covered === relevant.length ? "ok" : "partial";
}

function runWeatherStatus(run: PlanRun): ForecastStatus {
  if (run.weather !== "ok") return run.weather;
  switch (run.forecast.status) {
    case "computing":
      return "loading";
    case "ready":
      return forecastCoverage(run.forecast.plan);
    case "failed":
    case "none":
      return "unavailable";
  }
}

/** What a superseded run displayed. Its cleanup cancelled any unfinished forecast, which will never load. */
function displayedRun(run: PlanRun | null): DisplayedRun | null {
  const plan = run && displayedPlan(run);
  if (!run || !plan) return null;
  const status = runWeatherStatus(run);
  return {
    plan,
    label: run.label,
    inputKey: run.inputKey,
    weatherStatus: status === "loading" ? "unavailable" : status,
  };
}

export function usePlan(rawInput: unknown, label: string, weatherEnabled = true): UsePlanResult {
  const inputKey = JSON.stringify(rawInput);
  const computationKey = `${inputKey}::${weatherEnabled}`;
  // Every input transition and every retry is a new computation, even when an earlier input returns.
  const [computation, setComputation] = useState({ inputKey: computationKey, id: 0 });
  let computationId = computation.id;
  if (computation.inputKey !== computationKey) {
    computationId += 1;
    setComputation({ inputKey: computationKey, id: computationId });
  }
  const requestKey = String(computationId);

  const parsed = useMemo(() => {
    try {
      return parsePlanInput(JSON.parse(inputKey));
    } catch {
      return parsePlanInput(null);
    }
  }, [inputKey]);

  const [runs, setRuns] = useState<PlanRunsState>({ run: null, previous: null });
  const runnerRef = useRef<PlanRunner | null>(null);
  const labelRef = useRef(label);

  useEffect(() => {
    labelRef.current = label;
  }, [label]);

  useEffect(() => {
    return () => {
      runnerRef.current?.dispose();
      runnerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!parsed.ok) return;
    const input: PlanInput = parsed.value;
    const runLabel = labelRef.current;
    runnerRef.current ??= new PlanRunner();
    const runner = runnerRef.current;
    let cancelled = false;

    const update = (change: (run: PlanRun) => PlanRun) => {
      if (cancelled) return;
      setRuns((prev) => {
        if (prev.run?.requestKey === requestKey) return { ...prev, run: change(prev.run) };
        const fresh: PlanRun = {
          requestKey,
          inputKey,
          label: runLabel,
          base: null,
          weather: weatherEnabled ? "loading" : "disabled",
          forecast: { status: "none" },
        };
        return { run: change(fresh), previous: displayedRun(prev.run) ?? prev.previous };
      });
    };

    const abortController = new AbortController();
    const { signal } = abortController;
    const ignoreCancellation = (error: unknown) => {
      if (!signal.aborted) throw error;
    };

    runner.compute(input, { signal }).then((base) => update((run) => ({ ...run, base })), ignoreCancellation);

    if (weatherEnabled)
      void fetchCloudForecast(input.latitude, input.longitude, input.date, { signal }).then((weather) => {
        const usable = weather.status === "ok" && weather.samples.length > 0;
        update((run) => ({
          ...run,
          weather: weather.status,
          forecast: usable ? { status: "computing" } : { status: "none" },
        }));
        if (!usable || cancelled) return;
        runner.compute({ ...input, cloudCover: weather.samples }, { signal }).then(
          (result) =>
            update((run) => ({
              ...run,
              forecast: result.ok ? { status: "ready", plan: result.plan } : { status: "failed" },
            })),
          ignoreCancellation,
        );
      });

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [parsed, inputKey, requestKey, weatherEnabled]);

  const retry = useCallback(() => {
    runnerRef.current?.reset();
    setComputation((c) => ({ ...c, id: c.id + 1 }));
  }, []);

  if (!parsed.ok) {
    return {
      plan: null,
      status: "error",
      errors: parsed.errors,
      isWorkerError: false,
      weatherStatus: "unavailable",
      stalePlan: null,
      retry,
    };
  }

  const current = runs.run?.requestKey === requestKey ? runs.run : null;
  // The label can change without a new computation (10 becoming 10.0); a stale plan keeps the last one shown.
  if (current && current.label !== label) {
    setRuns((prev) =>
      prev.run?.requestKey === requestKey ? { ...prev, run: { ...prev.run, label } } : prev,
    );
  }
  const stale = current ? runs.previous : (displayedRun(runs.run) ?? runs.previous);
  const plan = current && displayedPlan(current);

  if (plan && current) {
    return {
      plan,
      status: "ready",
      errors: [],
      isWorkerError: false,
      weatherStatus: runWeatherStatus(current),
      stalePlan: null,
      retry,
    };
  }

  if (current?.base && !current.base.ok) {
    return {
      plan: null,
      status: "error",
      errors: current.base.errors,
      isWorkerError: current.base.isWorkerError,
      weatherStatus: "unavailable",
      stalePlan: null,
      retry,
    };
  }

  return {
    plan: null,
    status: "computing",
    errors: [],
    isWorkerError: false,
    weatherStatus: weatherEnabled ? "loading" : "disabled",
    // With the forecast now off, the stale plan's earlier forecast status no longer applies.
    stalePlan:
      stale && stale.inputKey !== inputKey
        ? {
            plan: stale.plan,
            label: stale.label,
            weatherStatus: weatherEnabled ? stale.weatherStatus : "disabled",
          }
        : null,
    retry,
  };
}
