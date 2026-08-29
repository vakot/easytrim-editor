import type { QueueFinishAction } from "./queue.types";

const QUEUE_FINISH_ACTIONS: readonly QueueFinishAction[] = [
  "exit",
  "systemSleep",
  "systemShutdown",
  "nothing",
];

export function isQueueFinishAction(value: unknown): value is QueueFinishAction {
  return typeof value === "string" && QUEUE_FINISH_ACTIONS.includes(value as QueueFinishAction);
}

export function normalizeQueueError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string") return new Error(message);
  }
  return new Error("The queue finish action could not be completed.");
}
