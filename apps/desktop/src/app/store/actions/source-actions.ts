import { createAction } from "@reduxjs/toolkit";

import type { EditorSnapshot } from "@/domain/editor-snapshot";
import type { SourceRef } from "@/domain/source";
import type { AppError, MediaInfo } from "@/lib/tauri/media.types";

const sourceSelected = createAction<{
  loadToken?: number;
  mergeAudio?: boolean;
  source: SourceRef;
}>("source/selected");

const sourceCleared = createAction("source/cleared");

const sourceReady = createAction<{
  loadToken: number;
  media: MediaInfo;
  snapshot?: EditorSnapshot;
}>("source/ready");

const sourceFailed = createAction<{ error: AppError; loadToken?: number }>("source/failed");

const sourceErrorReported = createAction<AppError>("source/error-reported");

function isValidSourceReadyPayload(
  currentLoadToken: number,
  payload: { loadToken: number },
): boolean {
  return currentLoadToken === payload.loadToken;
}

export {
  isValidSourceReadyPayload,
  sourceCleared,
  sourceErrorReported,
  sourceFailed,
  sourceReady,
  sourceSelected,
};
