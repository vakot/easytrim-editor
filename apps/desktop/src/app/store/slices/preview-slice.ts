import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { editingInstanceActivated } from "@/app/store/actions/editing-instance-actions";
import { sourceCleared, sourceFailed, sourceSelected } from "@/app/store/actions/source-actions";
import {
  editingInstanceClosed,
  editingInstancesClosed,
} from "@/app/store/slices/editing-instances-slice";
import type { EditingInstanceId } from "@/domain/editing-instance";
import type {
  AppError,
  PreviewDescriptor,
  PreviewKind,
  ThumbnailDescriptor,
} from "@/lib/tauri/media.types";

import type { RootState } from "../store";

export type PreviewState =
  | { status: "idle" }
  | { kind: PreviewKind; status: "loading" }
  | { status: "ready"; value: PreviewDescriptor }
  | { error: AppError; status: "failed" };

interface PreviewSliceState {
  importedThumbnails: Record<EditingInstanceId, ImportedThumbnailState>;
  value: PreviewState;
}

export type ImportedThumbnailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; value: ThumbnailDescriptor }
  | { error: AppError; status: "failed" };

export const initialPreviewState: PreviewSliceState = {
  importedThumbnails: {},
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
    importedThumbnailLoading: (state, action: PayloadAction<{ instanceId: EditingInstanceId }>) => {
      state.importedThumbnails[action.payload.instanceId] = { status: "loading" };
    },
    importedThumbnailReady: (
      state,
      action: PayloadAction<{ instanceId: EditingInstanceId; thumbnail: ThumbnailDescriptor }>,
    ) => {
      state.importedThumbnails[action.payload.instanceId] = {
        status: "ready",
        value: action.payload.thumbnail,
      };
    },
    importedThumbnailFailed: (
      state,
      action: PayloadAction<{ error: AppError; instanceId: EditingInstanceId }>,
    ) => {
      state.importedThumbnails[action.payload.instanceId] = {
        error: action.payload.error,
        status: "failed",
      };
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
        delete state.importedThumbnails[action.payload];
      })
      .addCase(editingInstancesClosed, (state, action) => {
        for (const instanceId of action.payload) delete state.importedThumbnails[instanceId];
      });
  },
});

const {
  importedThumbnailFailed,
  importedThumbnailLoading,
  importedThumbnailReady,
  previewFailed,
  previewLoading,
  previewReady,
} = previewSlice.actions;

const previewReducer = previewSlice.reducer;

const selectPreview = (state: RootState): PreviewState => state.preview.value;
const selectImportedSourceThumbnails = (
  state: RootState,
): Record<EditingInstanceId, ImportedThumbnailState> => state.preview.importedThumbnails;

const selectImportedSourceThumbnail = (state: RootState, id: EditingInstanceId) =>
  state.preview.importedThumbnails[id];

export {
  importedThumbnailFailed,
  importedThumbnailLoading,
  importedThumbnailReady,
  previewFailed,
  previewLoading,
  previewReady,
  previewReducer,
  selectImportedSourceThumbnail,
  selectImportedSourceThumbnails,
  selectPreview,
};
