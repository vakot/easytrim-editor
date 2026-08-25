import { createAction } from "@reduxjs/toolkit";

import type { MediaInfo, SourceSelection } from "@/lib/tauri/media";
import type { AppError } from "@/lib/tauri/media";

export const sourceSelected = createAction<{
  source: SourceSelection;
  mergeAudio?: boolean;
}>("source/selected");

export const sourceCleared = createAction("source/cleared");

export const sourceReady = createAction<{ sourceId: string; media: MediaInfo }>("source/ready");

export const sourceFailed = createAction<{ sourceId?: string; error: AppError }>("source/failed");

export function isValidSourceReadyPayload(
  currentSourceId: string | null,
  payload: { sourceId: string; media: { sourceId: string } },
): boolean {
  return currentSourceId === payload.sourceId && payload.media.sourceId === payload.sourceId;
}
