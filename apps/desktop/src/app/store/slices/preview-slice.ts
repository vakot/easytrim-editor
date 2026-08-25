import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { sourceCleared, sourceFailed, sourceSelected } from "@/app/store/actions/source-actions";
import type { AppError, PreviewDescriptor, PreviewKind } from "@/lib/tauri/media";
import type { RootState } from "../store";

export type PreviewState =
  | { status: "idle" }
  | { status: "loading"; kind: PreviewKind }
  | { status: "ready"; value: PreviewDescriptor }
  | { status: "failed"; error: AppError };

export interface PreviewSliceState {
  sourceId: string | null;
  value: PreviewState;
}

export const initialPreviewState: PreviewSliceState = {
  sourceId: null,
  value: { status: "idle" },
};

const previewSlice = createSlice({
  name: "preview",
  initialState: initialPreviewState,
  reducers: {
    previewLoading: (state, action: PayloadAction<{ sourceId: string; kind: PreviewKind }>) => {
      if (state.sourceId !== action.payload.sourceId) return;
      state.value = { status: "loading", kind: action.payload.kind };
    },
    previewReady: (
      state,
      action: PayloadAction<{ sourceId: string; preview: PreviewDescriptor }>,
    ) => {
      if (
        state.sourceId !== action.payload.sourceId ||
        action.payload.preview.sourceId !== action.payload.sourceId
      )
        return;
      state.value = { status: "ready", value: action.payload.preview };
    },
    previewFailed: (state, action: PayloadAction<{ sourceId: string; error: AppError }>) => {
      if (state.sourceId !== action.payload.sourceId) return;
      state.value = { status: "failed", error: action.payload.error };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sourceSelected, (state, action) => {
        state.sourceId = action.payload.source.sourceId;
        state.value = { status: "idle" };
      })
      .addCase(sourceCleared, (state) => {
        state.sourceId = null;
        state.value = { status: "idle" };
      })
      .addCase(sourceFailed, (state, action) => {
        if (action.payload.sourceId) return;
        state.sourceId = null;
        state.value = { status: "idle" };
      });
  },
});

export const { previewLoading, previewReady, previewFailed } = previewSlice.actions;
export const previewReducer = previewSlice.reducer;

export const selectPreview = (state: RootState): PreviewState => state.preview.value;
export const selectPreviewStatus = (state: RootState): PreviewState["status"] =>
  state.preview.value.status;
