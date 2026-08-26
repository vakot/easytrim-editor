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
        state.value = { status: "idle" };
      })
      .addCase(sourceCleared, (state) => {
        state.value = { status: "idle" };
      })
      .addCase(sourceFailed, (state) => {
        state.value = { status: "idle" };
      });
  },
});

export const { previewLoading, previewReady, previewFailed } = previewSlice.actions;
export const previewReducer = previewSlice.reducer;

export const selectPreview = (state: RootState): PreviewState => state.preview.value;
export const selectPreviewStatus = (state: RootState): PreviewState["status"] =>
  state.preview.value.status;
