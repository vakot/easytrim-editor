import { invoke } from "@tauri-apps/api/core";

import type { QueueFinishAction } from "./queue.types";

const QUEUE_FINISH_ACTIONS: readonly QueueFinishAction[] = [
  "exit",
  "systemSleep",
  "systemShutdown",
  "nothing",
];

function isQueueFinishAction(value: unknown): value is QueueFinishAction {
  return typeof value === "string" && QUEUE_FINISH_ACTIONS.includes(value as QueueFinishAction);
}

function normalizeQueueError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string") return new Error(message);
  }
  return new Error("The queue finish action could not be completed.");
}

export async function availableQueueFinishActions(): Promise<QueueFinishAction[]> {
  try {
    const value: unknown = await invoke("available_queue_finish_actions");
    if (!Array.isArray(value)) throw new Error("Invalid queue finish actions response.");
    return value.filter(isQueueFinishAction);
  } catch (error: unknown) {
    throw normalizeQueueError(error);
  }
}

export async function performQueueFinishAction(action: QueueFinishAction): Promise<void> {
  try {
    await invoke("perform_queue_finish_action", { action });
  } catch (error: unknown) {
    throw normalizeQueueError(error);
  }
}
