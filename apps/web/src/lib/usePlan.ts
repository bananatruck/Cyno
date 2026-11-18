import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InputError, NightPlan, PlanInput } from "@cyno/engine";
import { parsePlanInput } from "@cyno/engine/input";
import { PlanRunner, type ComputeResult } from "./planRunner";
import { fetchCloudForecast, type WeatherStatus } from "./weather";

export type PlanStatus = "idle" | "computing" | "ready" | "error";

/** A finished plan for an earlier input, with the place label it was computed for. */
export interface StalePlan {
  plan: NightPlan;
  label: string;
  weatherStatus: WeatherStatus | "loading";
}

export interface UsePlanResult {
  /** The plan for the current input, or null while it is computing or invalid. */
  plan: NightPlan | null;
  status: PlanStatus;
  errors: InputError[];
  isWorkerError: boolean;
  weatherStatus: WeatherStatus | "loading";
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

function runWeatherStatus(run: PlanRun): WeatherStatus | "loading" {
  if (run.weather !== "ok") return run.weather;
  switch (run.forecast.status) {
    case "computing":
      return "loading";
    case "ready":
      return run.forecast.plan.timeline.some((sample) => sample.cloudPercent !== null) ? "ok" : "unavailable";
    case "failed":
    case "none":
      return "unavailable";
  }
}

function displayedRun(run: PlanRun | null): DisplayedRun | null {
  const plan = run && displayedPlan(run);
  if (!run || !plan) return null;
  return { plan, label: run.label, inputKey: run.inputKey, weatherStatus: runWeatherStatus(run) };
}

export function usePlan(rawInput: unknown, label: string): UsePlanResult {
  const [retryCount, setRetryCount] = useState(0);
  const inputKey = JSON.stringify(rawInput);
  const requestKey = `${inputKey}::${retryCount}`;

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
          weather: "loading",
          forecast: { status: "none" },
        };
        return { run: change(fresh), previous: displayedRun(prev.run) ?? prev.previous };
      });
    };

    void runner.compute(input).then((base) => update((run) => ({ ...run, base })));

    const abortController = new AbortController();
    void fetchCloudForecast(input.latitude, input.longitude, input.date, {
      signal: abortController.signal,
    }).then((weather) => {
      const usable = weather.status === "ok" && weather.samples.length > 0;
      update((run) => ({
        ...run,
        weather: weather.status,
        forecast: usable ? { status: "computing" } : { status: "none" },
      }));
      if (!usable || cancelled) return;
      void runner.compute({ ...input, cloudCover: weather.samples }).then((result) =>
        update((run) => ({
          ...run,
          forecast: result.ok ? { status: "ready", plan: result.plan } : { status: "failed" },
        })),
      );
    });

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [parsed, inputKey, requestKey]);

  const retry = useCallback(() => {
    runnerRef.current?.reset();
    setRetryCount((c) => c + 1);
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
    weatherStatus: "loading",
    stalePlan:
      stale && stale.inputKey !== inputKey
        ? { plan: stale.plan, label: stale.label, weatherStatus: stale.weatherStatus }
        : null,
    retry,
  };
}
