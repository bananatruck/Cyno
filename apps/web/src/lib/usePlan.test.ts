import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { planNight, PlanInputError, type CloudSample } from "@cyno/engine";
import type { WorkerRequest, WorkerResponse } from "./plan.worker";
import { fetchCloudForecast, type WeatherResult } from "./weather";
import { usePlan } from "./usePlan";

vi.mock("./weather", () => ({ fetchCloudForecast: vi.fn() }));

const LONG_BEACH = {
  latitude: 33.77,
  longitude: -118.19,
  date: "2026-11-17",
  sky: "suburban",
  equipment: "eye",
};
const TOKYO = { latitude: 35.68, longitude: 139.69, date: "2026-11-17", sky: "suburban", equipment: "eye" };

/** Hourly 40% cloud from 2026-11-17T18:00Z for 30 hours, covering the Long Beach night. */
const NIGHT_CLOUDS: CloudSample[] = Array.from({ length: 30 }, (_, hour) => ({
  time: new Date(Date.parse("2026-11-17T18:00:00Z") + hour * 3_600_000).toISOString(),
  percent: 40,
}));

const forecast = vi.mocked(fetchCloudForecast);

describe("weather privacy", () => {
  it("computes and updates plans without requesting weather when disabled", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const { result, rerender } = renderHook(({ input }) => usePlan(input, "Place", false), {
      initialProps: { input: LONG_BEACH },
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.weatherStatus).toBe("disabled");
    expect(result.current.plan?.timeline.every((sample) => sample.cloudPercent === null)).toBe(true);
    rerender({ input: TOKYO });
    await waitFor(() => expect(result.current.plan?.input.latitude).toBe(TOKYO.latitude));
    expect(forecast).not.toHaveBeenCalled();
  });

  it("cancels a pending forecast on opt-out, ignores its late response, and can opt back in", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const pending = deferred<WeatherResult>();
    forecast.mockReturnValueOnce(pending.promise);
    const { result, rerender } = renderHook((enabled) => usePlan(LONG_BEACH, "Place", enabled), {
      initialProps: true,
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const signal = forecast.mock.calls[0]?.[3]?.signal;
    rerender(false);
    expect(signal?.aborted).toBe(true);
    await act(async () => pending.resolve({ samples: NIGHT_CLOUDS, status: "ok" }));
    await waitFor(() => expect(result.current.weatherStatus).toBe("disabled"));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.plan?.timeline.every((sample) => sample.cloudPercent === null)).toBe(true);
    expect(forecast).toHaveBeenCalledTimes(1);
    forecast.mockResolvedValue({ samples: NIGHT_CLOUDS, status: "ok" });
    rerender(true);
    await waitFor(() => expect(result.current.weatherStatus).toBe("ok"));
    expect(forecast).toHaveBeenCalledTimes(2);
  });
});

/** Stands in for the module worker; requests wait until flush() unless auto is set. */
class FakeWorker {
  static instances: FakeWorker[] = [];
  static behaviour: "auto" | "manual" | "fail-to-start" | "throw-on-construct" = "auto";
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  queue: WorkerRequest[] = [];
  terminated = false;
  readonly behaviour = FakeWorker.behaviour;

  constructor() {
    if (this.behaviour === "throw-on-construct") {
      throw new DOMException("Workers are not allowed here", "SecurityError");
    }
    FakeWorker.instances.push(this);
    if (this.behaviour === "fail-to-start") {
      setTimeout(() => this.onerror?.(new ErrorEvent("error", { message: "Failed to load worker script" })));
    }
  }

  postMessage(request: WorkerRequest) {
    this.queue.push(request);
    if (this.behaviour === "auto") setTimeout(() => this.flush());
  }

  /** Answers the oldest queued requests with a worker error. */
  fail(count = this.queue.length) {
    for (const { id } of this.queue.splice(0, count)) {
      this.onmessage?.(
        new MessageEvent("message", {
          data: {
            id,
            ok: false,
            errors: [{ field: "input", message: "Worker crashed" }],
            isWorkerError: true,
          },
        }),
      );
    }
  }

  flush(count = this.queue.length) {
    const requests = this.queue.splice(0, count);
    for (const { id, input } of requests) {
      if (this.terminated) return;
      let response: WorkerResponse;
      try {
        response = { id, ok: true, plan: planNight(input) };
      } catch (err) {
        response =
          err instanceof PlanInputError
            ? { id, ok: false, errors: err.errors }
            : { id, ok: false, errors: [{ field: "input", message: String(err) }], isWorkerError: true };
      }
      this.onmessage?.(new MessageEvent("message", { data: response }));
    }
  }

  terminate() {
    this.terminated = true;
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  FakeWorker.instances = [];
  FakeWorker.behaviour = "auto";
  forecast.mockReset();
  forecast.mockResolvedValue({ samples: [], status: "offline" });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("usePlan without a worker", () => {
  it("keeps the offline plan and marks the forecast unavailable when the forecast run is rejected", async () => {
    forecast.mockResolvedValue({
      samples: [{ time: "2026-11-17T22:00:00.000Z", percent: 150 }],
      status: "ok",
    });
    const { result } = renderHook(() => usePlan(LONG_BEACH, "Long Beach, CA"));
    await waitFor(() => expect(result.current.weatherStatus).toBe("unavailable"));
    expect(result.current.status).toBe("ready");
    expect(result.current.errors).toEqual([]);
    expect(result.current.plan?.input.latitude).toBe(33.77);
    expect(result.current.plan?.input.cloudCover).toBeNull();
  });

  it("reports the forecast in use once the shown plan was computed with it", async () => {
    forecast.mockResolvedValue({ samples: NIGHT_CLOUDS, status: "ok" });
    const { result } = renderHook(() => usePlan(LONG_BEACH, "Long Beach, CA"));
    await waitFor(() => expect(result.current.weatherStatus).toBe("ok"));
    expect(result.current.plan?.timeline.some((sample) => sample.cloudPercent !== null)).toBe(true);
  });

  it("does not report a forecast that misses the whole night as in use", async () => {
    forecast.mockResolvedValue({
      samples: [{ time: "2026-11-10T00:00:00.000Z", percent: 40 }],
      status: "ok",
    });
    const { result } = renderHook(() => usePlan(LONG_BEACH, "Long Beach, CA"));
    await waitFor(() => expect(result.current.weatherStatus).toBe("unavailable"));
    expect(result.current.status).toBe("ready");
    expect(result.current.plan).not.toBeNull();
  });

  it("does not report a forecast that only covers daylight as in use", async () => {
    forecast.mockResolvedValue({
      samples: [{ time: "2026-11-17T20:00:00.000Z", percent: 40 }],
      status: "ok",
    });
    const { result } = renderHook(() => usePlan(LONG_BEACH, "Long Beach, CA"));
    await waitFor(() => expect(result.current.plan?.input.cloudCover).toBeTruthy());
    const timeline = result.current.plan!.timeline;
    const covered = timeline.filter((sample) => sample.cloudPercent !== null);
    expect(covered.length).toBeGreaterThan(0);
    expect(covered.every((sample) => sample.sunAltDeg >= -0.833)).toBe(true);
    expect(result.current.weatherStatus).toBe("unavailable");
  });

  it("reports a forecast that covers only some dark samples as partial", async () => {
    forecast.mockResolvedValue({ samples: NIGHT_CLOUDS.slice(0, 12), status: "ok" });
    const { result } = renderHook(() => usePlan(LONG_BEACH, "Long Beach, CA"));
    await waitFor(() => expect(result.current.plan?.input.cloudCover).toBeTruthy());
    const dark = result.current.plan!.timeline.filter((sample) => sample.sunAltDeg < -0.833);
    expect(dark.some((sample) => sample.cloudPercent !== null)).toBe(true);
    expect(dark.some((sample) => sample.cloudPercent === null)).toBe(true);
    expect(result.current.weatherStatus).toBe("partial");
  });
});

describe("usePlan with a worker", () => {
  beforeEach(() => {
    vi.stubGlobal("Worker", FakeWorker);
  });

  it("says the forecast is loading until the forecast plan replaces the offline one", async () => {
    FakeWorker.behaviour = "manual";
    forecast.mockResolvedValue({ samples: NIGHT_CLOUDS, status: "ok" });
    const { result } = renderHook(() => usePlan(LONG_BEACH, "Long Beach, CA"));
    const worker = FakeWorker.instances[0]!;
    await waitFor(() => expect(worker.queue).toHaveLength(2));

    await act(async () => worker.flush(1));
    expect(result.current.status).toBe("ready");
    expect(result.current.plan?.input.cloudCover).toBeNull();
    expect(result.current.weatherStatus).toBe("loading");

    await act(async () => worker.flush());
    expect(result.current.weatherStatus).toBe("ok");
    expect(result.current.plan?.input.cloudCover).not.toBeNull();
  });

  it("drops a worker that fails to start and uses a fresh one", async () => {
    FakeWorker.behaviour = "fail-to-start";
    const { result } = renderHook(() => usePlan(LONG_BEACH, "Long Beach, CA"));
    FakeWorker.behaviour = "auto";
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(FakeWorker.instances).toHaveLength(2);
    expect(FakeWorker.instances[0]!.terminated).toBe(true);
    expect(result.current.plan?.input.latitude).toBe(33.77);
  });

  it("falls back to the main thread when a fresh worker also fails, and keeps answering", async () => {
    FakeWorker.behaviour = "fail-to-start";
    const { result, rerender } = renderHook(({ input, label }) => usePlan(input, label), {
      initialProps: { input: LONG_BEACH, label: "Long Beach, CA" },
    });
    await waitFor(() => expect(result.current.status).toBe("ready"), { timeout: 5000 });
    expect(result.current.isWorkerError).toBe(false);
    expect(FakeWorker.instances).toHaveLength(2);

    rerender({ input: TOKYO, label: "Tokyo" });
    await waitFor(() => expect(result.current.plan?.input.latitude).toBe(35.68), { timeout: 5000 });
    expect(FakeWorker.instances).toHaveLength(2);
  });

  it("falls back to the main thread when the Worker constructor throws a SecurityError", async () => {
    FakeWorker.behaviour = "throw-on-construct";
    forecast.mockResolvedValue({ samples: NIGHT_CLOUDS, status: "ok" });
    const { result } = renderHook(() => usePlan(LONG_BEACH, "Long Beach, CA"));
    await waitFor(() => expect(result.current.weatherStatus).toBe("ok"), { timeout: 5000 });
    expect(result.current.status).toBe("ready");
    expect(result.current.isWorkerError).toBe(false);
    expect(result.current.plan?.input.cloudCover).not.toBeNull();
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it("never shows the previous location's plan as the current one", async () => {
    FakeWorker.behaviour = "manual";
    const tokyoForecast = deferred<WeatherResult>();
    forecast.mockImplementation(async (latitude) =>
      latitude === TOKYO.latitude ? tokyoForecast.promise : { samples: [], status: "offline" },
    );
    const { result, rerender } = renderHook(({ input, label }) => usePlan(input, label), {
      initialProps: { input: LONG_BEACH, label: "Long Beach, CA" },
    });
    const worker = FakeWorker.instances[0]!;
    await waitFor(() => expect(worker.queue).toHaveLength(1));
    await act(async () => worker.flush());
    await waitFor(() => expect(result.current.weatherStatus).toBe("offline"));
    expect(result.current.plan?.input.latitude).toBe(33.77);

    rerender({ input: TOKYO, label: "Tokyo" });
    expect(result.current.plan).toBeNull();
    expect(result.current.status).toBe("computing");
    expect(result.current.stalePlan?.label).toBe("Long Beach, CA");
    expect(result.current.stalePlan?.plan.input.latitude).toBe(33.77);

    await act(async () => {
      tokyoForecast.resolve({ samples: [], status: "unavailable" });
      await tokyoForecast.promise;
    });
    expect(result.current.plan).toBeNull();
    expect(result.current.status).toBe("computing");
    expect(result.current.stalePlan?.label).toBe("Long Beach, CA");

    await act(async () => worker.flush());
    expect(result.current.status).toBe("ready");
    expect(result.current.plan?.input.latitude).toBe(35.68);
    expect(result.current.stalePlan).toBeNull();
    expect(result.current.weatherStatus).toBe("unavailable");
  });

  it("shows the forecast as off for a stale plan once the forecast is turned off", async () => {
    FakeWorker.behaviour = "manual";
    forecast.mockResolvedValue({ samples: NIGHT_CLOUDS, status: "ok" });
    const { result, rerender } = renderHook(({ input, label, weather }) => usePlan(input, label, weather), {
      initialProps: { input: LONG_BEACH, label: "Long Beach, CA", weather: true },
    });
    const worker = FakeWorker.instances[0]!;
    await waitFor(() => expect(worker.queue).toHaveLength(2));
    await act(async () => worker.flush());
    await waitFor(() => expect(result.current.weatherStatus).toBe("ok"));

    // A new date with the forecast now off: the old plan stays on screen while the new one computes.
    rerender({ input: TOKYO, label: "Tokyo", weather: false });
    expect(result.current.status).toBe("computing");
    expect(result.current.stalePlan?.label).toBe("Long Beach, CA");
    expect(result.current.stalePlan?.weatherStatus).toBe("disabled");
  });

  it("does not show the cancelled forecast of a superseded plan as loading", async () => {
    FakeWorker.behaviour = "manual";
    forecast.mockImplementation(async (latitude) =>
      latitude === LONG_BEACH.latitude ? { samples: NIGHT_CLOUDS, status: "ok" } : new Promise(() => {}),
    );
    const { result, rerender } = renderHook(({ input, label }) => usePlan(input, label), {
      initialProps: { input: LONG_BEACH, label: "Long Beach, CA" },
    });
    const worker = FakeWorker.instances[0]!;
    await waitFor(() => expect(worker.queue).toHaveLength(2));
    await act(async () => worker.flush(1));
    expect(result.current.weatherStatus).toBe("loading");

    rerender({ input: TOKYO, label: "Tokyo" });
    expect(result.current.status).toBe("computing");
    expect(result.current.stalePlan?.label).toBe("Long Beach, CA");
    expect(result.current.stalePlan?.weatherStatus).toBe("unavailable");
  });

  it("does not show an earlier failure for the same input while it computes again", async () => {
    FakeWorker.behaviour = "manual";
    const { result, rerender } = renderHook(({ input, label }) => usePlan(input, label), {
      initialProps: { input: LONG_BEACH, label: "Long Beach, CA" },
    });
    const worker = FakeWorker.instances[0]!;
    await waitFor(() => expect(worker.queue).toHaveLength(1));
    await act(async () => worker.fail());
    expect(result.current.status).toBe("error");
    expect(result.current.isWorkerError).toBe(true);

    rerender({ input: TOKYO, label: "Tokyo" });
    rerender({ input: { ...LONG_BEACH }, label: "Long Beach, CA" });
    expect(result.current.status).toBe("computing");
    expect(result.current.isWorkerError).toBe(false);

    await waitFor(() => expect(worker.queue).toHaveLength(2));
    await act(async () => worker.flush());
    expect(result.current.status).toBe("ready");
    expect(result.current.plan?.input.latitude).toBe(33.77);
  });

  it("keeps the last label shown with a plan when that plan becomes stale", async () => {
    FakeWorker.behaviour = "manual";
    const { result, rerender } = renderHook(({ input, label }) => usePlan(input, label), {
      initialProps: { input: LONG_BEACH, label: "Home" },
    });
    const worker = FakeWorker.instances[0]!;
    await waitFor(() => expect(worker.queue).toHaveLength(1));
    await act(async () => worker.flush());
    expect(result.current.status).toBe("ready");

    rerender({ input: { ...LONG_BEACH }, label: "33.77°, -118.19°" });
    expect(worker.queue).toHaveLength(0);
    rerender({ input: TOKYO, label: "Tokyo" });
    expect(result.current.stalePlan?.label).toBe("33.77°, -118.19°");
  });

  it("ignores a forecast that arrives after the location changed", async () => {
    FakeWorker.behaviour = "manual";
    const longBeachForecast = deferred<WeatherResult>();
    forecast.mockImplementation(async (latitude) =>
      latitude === LONG_BEACH.latitude ? longBeachForecast.promise : { samples: [], status: "offline" },
    );
    const { result, rerender } = renderHook(({ input, label }) => usePlan(input, label), {
      initialProps: { input: LONG_BEACH, label: "Long Beach, CA" },
    });
    const worker = FakeWorker.instances[0]!;
    await waitFor(() => expect(worker.queue).toHaveLength(1));
    await act(async () => worker.flush());

    rerender({ input: TOKYO, label: "Tokyo" });
    await waitFor(() => expect(worker.queue).toHaveLength(1));
    await act(async () => worker.flush());
    expect(result.current.status).toBe("ready");
    expect(result.current.plan?.input.latitude).toBe(35.68);

    await act(async () => {
      longBeachForecast.resolve({ samples: NIGHT_CLOUDS, status: "ok" });
      await longBeachForecast.promise;
    });
    expect(worker.queue).toHaveLength(0);
    expect(result.current.status).toBe("ready");
    expect(result.current.plan?.input.latitude).toBe(35.68);
    expect(result.current.weatherStatus).toBe("offline");
  });
});
