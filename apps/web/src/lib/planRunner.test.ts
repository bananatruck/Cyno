import { afterEach, describe, expect, it, vi } from "vitest";
import { planNight } from "@cyno/engine";
import { PlanRunner } from "./planRunner";

vi.mock("@cyno/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@cyno/engine")>();
  return { ...actual, planNight: vi.fn(actual.planNight) };
});

const LONG_BEACH = { latitude: 33.77, longitude: -118.19, date: "2026-11-17" };
const TOKYO = { latitude: 35.68, longitude: 139.69, date: "2026-11-17" };

class ThrowingWorker {
  static constructed = 0;
  constructor() {
    ThrowingWorker.constructed += 1;
    throw new DOMException("Workers are not allowed here", "SecurityError");
  }
}

class UncloneableWorker {
  static instances: UncloneableWorker[] = [];
  onmessage: unknown = null;
  onerror: unknown = null;
  terminated = false;
  constructor() {
    UncloneableWorker.instances.push(this);
  }
  postMessage() {
    throw new DOMException("The object could not be cloned", "DataCloneError");
  }
  terminate() {
    this.terminated = true;
  }
}

/** Accepts requests, then fails to load its script, like a worker whose chunk cannot be fetched. */
class FailingWorker {
  static constructed = 0;
  onmessage: unknown = null;
  onerror: ((event: Partial<ErrorEvent>) => void) | null = null;
  constructor() {
    FailingWorker.constructed += 1;
    setTimeout(() => this.onerror?.({ preventDefault: () => {} }));
  }
  postMessage() {}
  terminate() {}
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(planNight).mockClear();
  ThrowingWorker.constructed = 0;
  UncloneableWorker.instances = [];
  FailingWorker.constructed = 0;
});

describe("PlanRunner", () => {
  it("computes on the main thread when the Worker constructor throws a SecurityError", async () => {
    vi.stubGlobal("Worker", ThrowingWorker);
    const runner = new PlanRunner();

    const first = await runner.compute(LONG_BEACH);
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.plan.input.latitude).toBe(33.77);

    const second = await runner.compute({ ...LONG_BEACH, latitude: 35.68 });
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.plan.input.latitude).toBe(35.68);
    expect(ThrowingWorker.constructed).toBe(2);
  });

  it("computes on the main thread when postMessage throws", async () => {
    vi.stubGlobal("Worker", UncloneableWorker);
    const runner = new PlanRunner();

    const result = await runner.compute(LONG_BEACH);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.input.latitude).toBe(33.77);
  });

  it("reports invalid input as an input error, not a worker error, after a failed construction", async () => {
    vi.stubGlobal("Worker", ThrowingWorker);
    const result = await new PlanRunner().compute({ ...LONG_BEACH, latitude: 95 });
    expect(result).toMatchObject({ ok: false, isWorkerError: false });
  });

  it("replays only requests that are still wanted after workers fail to start", async () => {
    vi.stubGlobal("Worker", FailingWorker);
    const runner = new PlanRunner();
    const superseded = new AbortController();
    const obsolete = runner
      .compute(LONG_BEACH, { signal: superseded.signal })
      .catch((error: unknown) => error);
    superseded.abort();
    const current = await runner.compute(TOKYO, { signal: new AbortController().signal });

    expect(await obsolete).toMatchObject({ name: "AbortError" });
    expect(FailingWorker.constructed).toBe(2);
    expect(current.ok).toBe(true);
    expect(vi.mocked(planNight).mock.calls.map(([input]) => input.latitude)).toEqual([35.68]);
  });

  it("does not start main-thread work for a request cancelled while the engine loads", async () => {
    vi.stubGlobal("Worker", ThrowingWorker);
    const runner = new PlanRunner();
    const controller = new AbortController();
    const result = runner.compute(LONG_BEACH, { signal: controller.signal });
    controller.abort();

    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    await runner.compute(TOKYO);
    expect(vi.mocked(planNight).mock.calls.map(([input]) => input.latitude)).toEqual([35.68]);
  });
});
