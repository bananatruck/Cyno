import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InputError, NightPlan, PlanInput } from "@cyno/engine";
import { parsePlanInput, PlanInputError } from "@cyno/engine/input";
import { fetchCloudForecast, type WeatherStatus } from "./weather";
import type { WorkerRequest, WorkerResponse } from "./plan.worker";

export type PlanStatus = "idle" | "computing" | "ready" | "error";

export interface UsePlanResult {
  plan: NightPlan | null;
  status: PlanStatus;
  errors: InputError[];
  isWorkerError: boolean;
  weatherStatus: WeatherStatus | "loading";
  retry: () => void;
}

interface AsyncPlanState {
  key: string;
  plan: NightPlan | null;
  status: PlanStatus;
  errors: InputError[];
  isWorkerError: boolean;
  weatherStatus: WeatherStatus | "loading";
}

export function usePlan(rawInput: unknown): UsePlanResult {
  const [retryCount, setRetryCount] = useState(0);
  const serializedInput = JSON.stringify(rawInput);
  const requestKey = `${serializedInput}::${retryCount}`;

  const parsed = useMemo(() => {
    try {
      return parsePlanInput(JSON.parse(serializedInput));
    } catch {
      return parsePlanInput(null);
    }
  }, [serializedInput]);

  const [asyncState, setAsyncState] = useState<AsyncPlanState>({
    key: "",
    plan: null,
    status: "idle",
    errors: [],
    isWorkerError: false,
    weatherStatus: "loading",
  });

  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  const ensureWorker = useCallback((): Worker | null => {
    if (typeof Worker === "undefined") return null;
    if (!workerRef.current) {
      const worker = new Worker(new URL("./plan.worker.ts", import.meta.url), {
        type: "module",
      });
      workerRef.current = worker;
    }
    return workerRef.current;
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const reqId = ++requestIdRef.current;
    if (!parsed.ok) return;

    const validInput: PlanInput = parsed.value;
    const worker = ensureWorker();

    if (worker) {
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const msg = event.data;
        if (msg.id !== requestIdRef.current) return;
        if (msg.ok) {
          setAsyncState((prev) => ({
            key: requestKey,
            plan: msg.plan,
            status: "ready",
            errors: [],
            isWorkerError: false,
            weatherStatus: prev.key === requestKey ? prev.weatherStatus : "loading",
          }));
        } else {
          setAsyncState({
            key: requestKey,
            plan: null,
            status: "error",
            errors: msg.errors,
            isWorkerError: Boolean(msg.isWorkerError),
            weatherStatus: "unavailable",
          });
        }
      };
      worker.onerror = (err) => {
        if (requestIdRef.current !== reqId) return;
        setAsyncState({
          key: requestKey,
          plan: null,
          status: "error",
          errors: [
            {
              field: "input",
              message: err.message || "The astronomy worker encountered an unexpected error.",
            },
          ],
          isWorkerError: true,
          weatherStatus: "unavailable",
        });
      };
    }

    const runCompute = (inputToRun: PlanInput) => {
      if (worker) {
        const message: WorkerRequest = { id: reqId, input: inputToRun };
        worker.postMessage(message);
      } else {
        void (async () => {
          try {
            const { planNight } = await import("@cyno/engine");
            if (requestIdRef.current !== reqId) return;
            const computed = planNight(inputToRun);
            if (requestIdRef.current !== reqId) return;
            setAsyncState((prev) => ({
              key: requestKey,
              plan: computed,
              status: "ready",
              errors: [],
              isWorkerError: false,
              weatherStatus: prev.key === requestKey ? prev.weatherStatus : "loading",
            }));
          } catch (err) {
            if (requestIdRef.current !== reqId) return;
            if (err instanceof PlanInputError) {
              setAsyncState({
                key: requestKey,
                plan: null,
                status: "error",
                errors: err.errors,
                isWorkerError: false,
                weatherStatus: "unavailable",
              });
            } else {
              setAsyncState({
                key: requestKey,
                plan: null,
                status: "error",
                errors: [
                  {
                    field: "input",
                    message: err instanceof Error ? err.message : "Failed to compute the night plan.",
                  },
                ],
                isWorkerError: true,
                weatherStatus: "unavailable",
              });
            }
          }
        })();
      }
    };

    // Always run first without clouds.
    runCompute(validInput);

    const abortController = new AbortController();
    void fetchCloudForecast(validInput.latitude, validInput.longitude, validInput.date, {
      signal: abortController.signal,
    }).then((weather) => {
      if (abortController.signal.aborted || requestIdRef.current !== reqId) return;
      setAsyncState((prev) => ({
        ...prev,
        key: requestKey,
        weatherStatus: weather.status,
      }));
      if (weather.status === "ok" && weather.samples.length > 0) {
        runCompute({ ...validInput, cloudCover: weather.samples });
      }
    });

    return () => {
      abortController.abort();
    };
  }, [parsed, requestKey, ensureWorker]);

  const retry = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setRetryCount((c) => c + 1);
  }, []);

  if (!parsed.ok) {
    return {
      plan: null,
      status: "error",
      errors: parsed.errors,
      isWorkerError: false,
      weatherStatus: "unavailable",
      retry,
    };
  }

  const isCurrent = asyncState.key === requestKey;

  return {
    plan: isCurrent ? asyncState.plan : asyncState.plan,
    status: isCurrent ? asyncState.status : "computing",
    errors: isCurrent ? asyncState.errors : [],
    isWorkerError: isCurrent ? asyncState.isWorkerError : false,
    weatherStatus: isCurrent ? asyncState.weatherStatus : "loading",
    retry,
  };
}
