import type { InputError, NightPlan, PlanInput } from "@cyno/engine";
import { PlanInputError } from "@cyno/engine/input";
import type { WorkerRequest, WorkerResponse } from "./plan.worker";

export type ComputeResult =
  { ok: true; plan: NightPlan } | { ok: false; errors: InputError[]; isWorkerError: boolean };

export interface ComputeOptions {
  /** Aborting drops the request: it is not replayed, and no main-thread work starts for it. */
  signal?: AbortSignal;
}

interface Request {
  input: PlanInput;
  signal: AbortSignal | undefined;
  resolve: (result: ComputeResult) => void;
  /** Settles the request with an error and drops its abort listener. */
  reject: (error: unknown) => void;
}

/** A request was still pending when its runner was disposed or reset; its result will never come. */
export class PlanRunnerDisposedError extends Error {
  constructor() {
    super("The plan runner was disposed before this plan was computed.");
    this.name = "PlanRunnerDisposedError";
  }
}

interface PendingRequest {
  request: Request;
  worker: Worker;
}

/** A worker that fails, then a fresh one that fails too, means workers do not work here. */
const MAX_WORKER_FAILURES = 2;

/** Null when the request was cancelled while the engine loaded. */
async function computeOnMainThread(input: PlanInput, signal?: AbortSignal): Promise<ComputeResult | null> {
  try {
    const { planNight } = await import("@cyno/engine");
    if (signal?.aborted) return null;
    return { ok: true, plan: planNight(input) };
  } catch (err) {
    if (err instanceof PlanInputError) return { ok: false, errors: err.errors, isWorkerError: false };
    return {
      ok: false,
      errors: [
        { field: "input", message: err instanceof Error ? err.message : "Failed to compute the night plan." },
      ],
      isWorkerError: true,
    };
  }
}

/** Runs planNight in a module worker, or on the main thread when workers are missing or broken. */
export class PlanRunner {
  private worker: Worker | null = null;
  private failures = 0;
  private nextId = 0;
  private readonly pending = new Map<number, PendingRequest>();

  /** Rejects with the signal's reason once the signal aborts. */
  compute(input: PlanInput, { signal }: ComputeOptions = {}): Promise<ComputeResult> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      const onAbort = () => {
        this.forget(request);
        reject(signal?.reason);
      };
      const request: Request = {
        input,
        signal,
        resolve: (result) => {
          signal?.removeEventListener("abort", onAbort);
          resolve(result);
        },
        reject: (error) => {
          signal?.removeEventListener("abort", onAbort);
          reject(error);
        },
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      this.dispatch(request);
    });
  }

  /** Forgets earlier worker failures, so the next request tries a worker again. */
  reset(): void {
    this.dispose();
    this.failures = 0;
  }

  /**
   * Stops the worker and rejects every request still waiting for it with PlanRunnerDisposedError, so no
   * promise is left pending; a request without a signal has no other way to settle.
   */
  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    const waiting = [...this.pending.values()];
    this.pending.clear();
    for (const { request } of waiting) request.reject(new PlanRunnerDisposedError());
  }

  private forget(request: Request): void {
    for (const [id, pending] of this.pending) {
      if (pending.request === request) this.pending.delete(id);
    }
  }

  private dispatch(request: Request): void {
    if (request.signal?.aborted) return;
    const worker = this.ensureWorker();
    if (!worker) {
      this.runOnMainThread(request);
      return;
    }
    const id = ++this.nextId;
    this.pending.set(id, { request, worker });
    const message: WorkerRequest = { id, input: request.input };
    try {
      worker.postMessage(message);
    } catch {
      this.pending.delete(id);
      this.runOnMainThread(request);
    }
  }

  private runOnMainThread(request: Request): void {
    void computeOnMainThread(request.input, request.signal).then((result) => {
      if (result) request.resolve(result);
    });
  }

  private ensureWorker(): Worker | null {
    if (typeof Worker === "undefined" || this.failures >= MAX_WORKER_FAILURES) return null;
    if (this.worker) return this.worker;
    let worker: Worker;
    try {
      worker = new Worker(new URL("./plan.worker.ts", import.meta.url), { type: "module" });
    } catch {
      this.failures += 1;
      return this.ensureWorker();
    }
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.handleMessage(event.data);
    worker.onerror = (event) => {
      event.preventDefault?.();
      this.handleWorkerError(worker);
    };
    this.worker = worker;
    return worker;
  }

  private handleMessage(msg: WorkerResponse): void {
    const pending = this.pending.get(msg.id);
    if (!pending) return;
    this.pending.delete(msg.id);
    this.failures = 0;
    pending.request.resolve(
      msg.ok
        ? { ok: true, plan: msg.plan }
        : { ok: false, errors: msg.errors, isWorkerError: Boolean(msg.isWorkerError) },
    );
  }

  private handleWorkerError(worker: Worker): void {
    worker.terminate();
    if (this.worker === worker) {
      this.worker = null;
      this.failures += 1;
    }
    const orphaned = [...this.pending].filter(([, pending]) => pending.worker === worker);
    for (const [id, pending] of orphaned) {
      this.pending.delete(id);
      this.dispatch(pending.request);
    }
  }
}
