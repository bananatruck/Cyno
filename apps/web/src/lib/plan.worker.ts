import { planNight, PlanInputError, type InputError, type NightPlan, type PlanInput } from "@cyno/engine";

export interface WorkerRequest {
  id: number;
  input: PlanInput;
}

export type WorkerResponse =
  | { id: number; ok: true; plan: NightPlan }
  | { id: number; ok: false; errors: InputError[]; isWorkerError?: boolean };

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, input } = event.data;
  try {
    const plan = planNight(input);
    const response: WorkerResponse = { id, ok: true, plan };
    self.postMessage(response);
  } catch (err) {
    if (err instanceof PlanInputError) {
      const response: WorkerResponse = { id, ok: false, errors: err.errors };
      self.postMessage(response);
    } else {
      const message = err instanceof Error ? err.message : "Failed to compute the night plan.";
      const response: WorkerResponse = {
        id,
        ok: false,
        errors: [{ field: "input", message }],
        isWorkerError: true,
      };
      self.postMessage(response);
    }
  }
};
