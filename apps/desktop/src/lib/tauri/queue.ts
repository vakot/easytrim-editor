import { invoke } from "@tauri-apps/api/core";

import type { QueueFinishAction } from "./queue.types";
import { isQueueFinishAction, normalizeQueueError } from "./queue.utils";

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
