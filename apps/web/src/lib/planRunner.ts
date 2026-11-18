import type { InputError, NightPlan, PlanInput } from "@cyno/engine";
import { PlanInputError } from "@cyno/engine/input";
import type { WorkerRequest, WorkerResponse } from "./plan.worker";

export type ComputeResult =
  { ok: true; plan: NightPlan } | { ok: false; errors: InputError[]; isWorkerError: boolean };

interface PendingRequest {
  input: PlanInput;
  worker: Worker;
  resolve: (result: ComputeResult) => void;
}

/** A worker that fails, then a fresh one that fails too, means workers do not work here. */
const MAX_WORKER_FAILURES = 2;

async function computeOnMainThread(input: PlanInput): Promise<ComputeResult> {
  try {
    const { planNight } = await import("@cyno/engine");
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

  compute(input: PlanInput): Promise<ComputeResult> {
    return new Promise((resolve) => this.dispatch(input, resolve));
  }

  /** Forgets earlier worker failures, so the next request tries a worker again. */
  reset(): void {
    this.dispose();
    this.failures = 0;
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }

  private dispatch(input: PlanInput, resolve: (result: ComputeResult) => void): void {
    const worker = this.ensureWorker();
    if (!worker) {
      void computeOnMainThread(input).then(resolve);
      return;
    }
    const id = ++this.nextId;
    this.pending.set(id, { input, worker, resolve });
    const message: WorkerRequest = { id, input };
    try {
      worker.postMessage(message);
    } catch {
      this.pending.delete(id);
      void computeOnMainThread(input).then(resolve);
    }
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
    const request = this.pending.get(msg.id);
    if (!request) return;
    this.pending.delete(msg.id);
    this.failures = 0;
    request.resolve(
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
    const orphaned = [...this.pending].filter(([, request]) => request.worker === worker);
    for (const [id, request] of orphaned) {
      this.pending.delete(id);
      this.dispatch(request.input, request.resolve);
    }
  }
}
