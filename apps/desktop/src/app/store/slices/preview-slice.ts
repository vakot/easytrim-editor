import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { editingInstanceActivated } from "@/app/store/actions/editing-instance-actions";
import { sourceCleared, sourceFailed, sourceSelected } from "@/app/store/actions/source-actions";
import {
  editingInstanceClosed,
  editingInstancesClosed,
} from "@/app/store/slices/editing-instances-slice";
import type { EditingInstanceId } from "@/domain/editing-instance";
import type { AppError, PreviewDescriptor, PreviewKind } from "@/lib/tauri/media.types";

import type { RootState } from "../store";

export type PreviewState =
  | { status: "idle" }
  | { kind: PreviewKind; status: "loading" }
  | { status: "ready"; value: PreviewDescriptor }
  | { error: AppError; status: "failed" };

interface PreviewSliceState {
  imported: Record<EditingInstanceId, ImportedPreviewState>;
  value: PreviewState;
}

export type ImportedPreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; value: PreviewDescriptor }
  | { error: AppError; status: "failed" };

export const initialPreviewState: PreviewSliceState = {
  imported: {},
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
    importedPreviewLoading: (state, action: PayloadAction<{ instanceId: EditingInstanceId }>) => {
      state.imported[action.payload.instanceId] = { status: "loading" };
    },
    importedPreviewReady: (
      state,
      action: PayloadAction<{ instanceId: EditingInstanceId; preview: PreviewDescriptor }>,
    ) => {
      state.imported[action.payload.instanceId] = {
        status: "ready",
        value: action.payload.preview,
      };
    },
    importedPreviewFailed: (
      state,
      action: PayloadAction<{ error: AppError; instanceId: EditingInstanceId }>,
    ) => {
      state.imported[action.payload.instanceId] = { error: action.payload.error, status: "failed" };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sourceSelected, (state) => {
        state.value = { status: "loading", kind: "source" };
      })
      .addCase(editingInstanceActivated, (state) => {
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
      })
      .addCase(editingInstanceClosed, (state, action) => {
        delete state.imported[action.payload];
      })
      .addCase(editingInstancesClosed, (state, action) => {
        for (const instanceId of action.payload) delete state.imported[instanceId];
      });
  },
});

export const {
  importedPreviewFailed,
  importedPreviewLoading,
  importedPreviewReady,
  previewFailed,
  previewLoading,
  previewReady,
} = previewSlice.actions;
export const previewReducer = previewSlice.reducer;

export const selectPreview = (state: RootState): PreviewState => state.preview.value;
export const selectImportedSourcePreviews = (
  state: RootState,
): Record<EditingInstanceId, ImportedPreviewState> => state.preview.imported;
