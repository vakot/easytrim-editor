import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import {
  sourceCleared,
  sourceFailed,
  sourceReady,
  sourceSelected,
} from "@/app/store/actions/source-actions";
import type { AppError, MediaCapabilities, MediaInfo, SourceSelection } from "@/lib/tauri/media";
import type { RootState } from "../store";

export type CapabilityState =
  | { status: "checking" }
  | { status: "ready"; value: MediaCapabilities }
  | { status: "failed"; error: AppError };

export type SourceStatus = "idle" | "loading-source" | "ready" | "failed";

export interface SourceState {
  status: SourceStatus;
  sourceId: string | null;
  selection: SourceSelection | null;
  media: MediaInfo | null;
  error: AppError | null;
  capabilities: CapabilityState;
}

export const initialSourceState: SourceState = {
  status: "idle",
  sourceId: null,
  selection: null,
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
        state.sourceId = action.payload.source.sourceId;
        state.selection = action.payload.source;
        state.media = null;
        state.error = null;
      })
      .addCase(sourceCleared, (state) => {
        state.status = "idle";
        state.sourceId = null;
        state.selection = null;
        state.media = null;
        state.error = null;
      })
      .addCase(sourceReady, (state, action) => {
        if (state.sourceId !== action.payload.sourceId) return;
        if (action.payload.media.sourceId !== action.payload.sourceId) return;
        state.status = "ready";
        state.media = action.payload.media;
        state.error = null;
      })
      .addCase(sourceFailed, (state, action) => {
        if (action.payload.sourceId && state.sourceId !== action.payload.sourceId) return;
        state.status = "failed";
        state.error = action.payload.error;
        if (!action.payload.sourceId) {
          state.sourceId = null;
          state.selection = null;
          state.media = null;
        }
      });
  },
});

export const { capabilitiesReady, capabilitiesFailed } = sourceSlice.actions;
export const sourceReducer = sourceSlice.reducer;

export const selectSourceStatus = (state: RootState): SourceStatus => state.source.status;
export const selectSourceId = (state: RootState): string | null => state.source.sourceId;
export const selectSourceSelection = (state: RootState): SourceSelection | null =>
  state.source.selection;
export const selectSourceMedia = (state: RootState): MediaInfo | null => state.source.media;
export const selectSourceError = (state: RootState): AppError | null => state.source.error;
export const selectCapabilities = (state: RootState): CapabilityState => state.source.capabilities;
export const selectHasSource = (state: RootState): boolean => state.source.selection !== null;
export const selectSourceReady = (state: RootState): boolean =>
  state.source.status === "ready" && state.source.media !== null;
