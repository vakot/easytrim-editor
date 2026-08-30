import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { importQueueItemActivated } from "@/app/store/actions/imported-queue-actions";
import { sourceCleared, sourceFailed, sourceSelected } from "@/app/store/actions/source-actions";
import type { AppError, PreviewDescriptor, PreviewKind } from "@/lib/tauri/media.types";

import type { RootState } from "../store";

export type PreviewState =
  | { status: "idle" }
  | { kind: PreviewKind; status: "loading" }
  | { status: "ready"; value: PreviewDescriptor }
  | { error: AppError; status: "failed" };

interface PreviewSliceState {
  value: PreviewState;
}

export const initialPreviewState: PreviewSliceState = {
  value: { status: "idle" },
};

const previewSlice = createSlice({
  name: "preview",
  initialState: initialPreviewState,
  reducers: {
    previewLoading: (state, action: PayloadAction<{ kind: PreviewKind }>) => {
      state.value = { status: "loading", kind: action.payload.kind };
    },
    previewReady: (state, action: PayloadAction<{ preview: PreviewDescriptor }>) => {
      state.value = { status: "ready", value: action.payload.preview };
    },
    previewFailed: (state, action: PayloadAction<{ error: AppError }>) => {
      state.value = { status: "failed", error: action.payload.error };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sourceSelected, (state) => {
        state.value = { status: "loading", kind: "source" };
      })
      .addCase(importQueueItemActivated, (state) => {
        state.value = { status: "loading", kind: "source" };
      })
      .addCase(sourceCleared, (state) => {
        state.value = { status: "idle" };
      })
      .addCase(sourceFailed, (state, action) => {
        state.value =
          action.payload.loadToken === undefined
            ? { status: "idle" }
            : { status: "failed", error: action.payload.error };
      });
  },
});

export const { previewFailed, previewLoading, previewReady } = previewSlice.actions;
export const previewReducer = previewSlice.reducer;

export const selectPreview = (state: RootState): PreviewState => state.preview.value;
