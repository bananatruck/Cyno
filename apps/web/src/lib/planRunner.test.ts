import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanRunner } from "./planRunner";

const LONG_BEACH = { latitude: 33.77, longitude: -118.19, date: "2026-11-17" };

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

afterEach(() => {
  vi.unstubAllGlobals();
  ThrowingWorker.constructed = 0;
  UncloneableWorker.instances = [];
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
});
