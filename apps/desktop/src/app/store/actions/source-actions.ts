import { createAction } from "@reduxjs/toolkit";

import type { SourceRef } from "@/domain/source";
import type { AppError, MediaInfo } from "@/lib/tauri/media.types";

export const sourceSelected = createAction<{
  source: SourceRef;
  mergeAudio?: boolean;
  loadToken?: number;
}>("source/selected");

export const sourceCleared = createAction("source/cleared");

export const sourceReady = createAction<{ loadToken: number; media: MediaInfo }>("source/ready");

export const sourceFailed = createAction<{ loadToken?: number; error: AppError }>("source/failed");

export const sourceErrorReported = createAction<AppError>("source/error-reported");

export function isValidSourceReadyPayload(
  currentLoadToken: number,
  payload: { loadToken: number },
): boolean {
  return currentLoadToken === payload.loadToken;
}
