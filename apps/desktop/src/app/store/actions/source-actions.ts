import { createAction } from "@reduxjs/toolkit";

import type { SourceRef } from "@/domain/source";
import type { AppError, MediaInfo } from "@/lib/tauri/media.types";

export const sourceSelected = createAction<{
  loadToken?: number;
  mergeAudio?: boolean;
  source: SourceRef;
}>("source/selected");

export const sourceCleared = createAction("source/cleared");

export const sourceReady = createAction<{ loadToken: number; media: MediaInfo }>("source/ready");

export const sourceFailed = createAction<{ error: AppError; loadToken?: number }>("source/failed");

export const sourceErrorReported = createAction<AppError>("source/error-reported");

export function isValidSourceReadyPayload(
  currentLoadToken: number,
  payload: { loadToken: number },
): boolean {
  return currentLoadToken === payload.loadToken;
}
