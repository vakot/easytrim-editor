import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { importQueueItemActivated } from "@/app/store/actions/imported-queue-actions";
import {
  isValidSourceReadyPayload,
  sourceCleared,
  sourceErrorReported,
  sourceFailed,
  sourceReady,
  sourceSelected,
} from "@/app/store/actions/source-actions";
import type { SourceRef } from "@/domain/source";
import type { AppError, MediaCapabilities, MediaInfo } from "@/lib/tauri/media.types";

import type { RootState } from "../store";

type CapabilityState =
  | { status: "checking" }
  | { status: "ready"; value: MediaCapabilities }
  | { error: AppError; status: "failed" };

type SourceStatus = "idle" | "loading-source" | "ready" | "failed";

interface SourceState {
  audioPanelStreamCount: number;
  capabilities: CapabilityState;
  error: AppError | null;
  loadToken: number;
  media: MediaInfo | null;
  source: SourceRef | null;
  status: SourceStatus;
}

export const initialSourceState: SourceState = {
  audioPanelStreamCount: 0,
  status: "idle",
  source: null,
  loadToken: 0,
  media: null,
  error: null,
  capabilities: { status: "checking" },
};

const sourceSlice = createSlice({
  name: "source",
  initialState: initialSourceState,
  reducers: {
    capabilitiesReady: (state, action: PayloadAction<MediaCapabilities>) => {
      state.capabilities = { status: "ready", value: action.payload };
    },
    capabilitiesFailed: (state, action: PayloadAction<AppError>) => {
      state.capabilities = { status: "failed", error: action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sourceSelected, (state, action) => {
        state.status = "loading-source";
        state.source = action.payload.source;
        state.loadToken = action.payload.loadToken ?? state.loadToken + 1;
        state.media = null;
        state.error = null;
      })
      .addCase(importQueueItemActivated, (state, action) => {
        state.status = "loading-source";
        state.source = action.payload.snapshot.source;
        state.loadToken = action.payload.loadToken;
        state.media = action.payload.media ?? null;
        if (action.payload.media) {
          state.audioPanelStreamCount = action.payload.media.audioStreams.length;
        }
        state.error = null;
      })
      .addCase(sourceCleared, (state) => {
        state.status = "idle";
        state.source = null;
        state.media = null;
        state.audioPanelStreamCount = 0;
        state.error = null;
        state.loadToken += 1;
      })
      .addCase(sourceReady, (state, action) => {
        if (!isValidSourceReadyPayload(state.loadToken, action.payload)) return;
        state.status = "ready";
        state.media = action.payload.media;
        state.audioPanelStreamCount = action.payload.media.audioStreams.length;
        state.error = null;
      })
      .addCase(sourceFailed, (state, action) => {
        if (action.payload.loadToken !== undefined && state.loadToken !== action.payload.loadToken)
          return;
        state.status = "failed";
        state.audioPanelStreamCount = 0;
        state.error = action.payload.error;
        if (action.payload.loadToken === undefined) {
          state.source = null;
          state.media = null;
        }
      })
      .addCase(sourceErrorReported, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const { capabilitiesFailed, capabilitiesReady } = sourceSlice.actions;
export const sourceReducer = sourceSlice.reducer;

export const selectSourceSelection = (state: RootState): SourceRef | null => state.source.source;
export const selectSourceMedia = (state: RootState): MediaInfo | null => state.source.media;
export const selectAudioPanelStreamCount = (state: RootState): number =>
  state.source.audioPanelStreamCount;
export const selectCapabilities = (state: RootState): CapabilityState => state.source.capabilities;
export const selectHasSource = (state: RootState): boolean => state.source.source !== null;
export const selectSourceReady = (state: RootState): boolean =>
  state.source.status === "ready" && state.source.media !== null;
export const selectSourceLoadToken = (state: RootState): number => state.source.loadToken;
