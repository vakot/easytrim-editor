import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { AppError } from "@/lib/tauri/media";
import type { RootState } from "../store";

export interface ImportWorkflowState {
  isChoosingSource: boolean;
  isNativeDialogOpen: boolean;
  isSourceDragActive: boolean;
  dropListenerError: AppError | null;
}

export const initialImportWorkflowState: ImportWorkflowState = {
  isChoosingSource: false,
  isNativeDialogOpen: false,
  isSourceDragActive: false,
  dropListenerError: null,
};

const importWorkflowSlice = createSlice({
  name: "importWorkflow",
  initialState: initialImportWorkflowState,
  reducers: {
    sourceChoiceStarted: (state) => {
      state.isChoosingSource = true;
      state.isNativeDialogOpen = true;
      state.dropListenerError = null;
    },
    sourceChoiceFinished: (state) => {
      state.isChoosingSource = false;
      state.isNativeDialogOpen = false;
    },
    nativeDialogStateChanged: (state, action: PayloadAction<boolean>) => {
      state.isNativeDialogOpen = action.payload;
    },
    sourceDragChanged: (state, action: PayloadAction<boolean>) => {
      state.isSourceDragActive = action.payload;
    },
    dropListenerErrorCleared: (state) => {
      state.dropListenerError = null;
    },
    dropListenerFailed: (state, action: PayloadAction<AppError>) => {
      state.isSourceDragActive = false;
      state.dropListenerError = action.payload;
    },
  },
});

export const {
  sourceChoiceStarted,
  sourceChoiceFinished,
  nativeDialogStateChanged,
  sourceDragChanged,
  dropListenerErrorCleared,
  dropListenerFailed,
} = importWorkflowSlice.actions;

export const importWorkflowReducer = importWorkflowSlice.reducer;

export const selectIsChoosingSource = (state: RootState): boolean =>
  state.importWorkflow.isChoosingSource;
export const selectIsNativeDialogOpen = (state: RootState): boolean =>
  state.importWorkflow.isNativeDialogOpen;
export const selectIsSourceDragActive = (state: RootState): boolean =>
  state.importWorkflow.isSourceDragActive;
export const selectDropListenerError = (state: RootState): AppError | null =>
  state.importWorkflow.dropListenerError;
