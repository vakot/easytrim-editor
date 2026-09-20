import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { AppError } from "@/lib/tauri/media.types";

import type { RootState } from "../store";

interface ImportWorkflowState {
  dropListenerError: AppError | null;
  isChoosingSource: boolean;
  isNativeDialogOpen: boolean;
  isSourceDragActive: boolean;
}

const initialImportWorkflowState: ImportWorkflowState = {
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

const {
  dropListenerErrorCleared,
  dropListenerFailed,
  nativeDialogStateChanged,
  sourceChoiceFinished,
  sourceChoiceStarted,
  sourceDragChanged,
} = importWorkflowSlice.actions;

const importWorkflowReducer = importWorkflowSlice.reducer;

const selectIsChoosingSource = (state: RootState): boolean => state.importWorkflow.isChoosingSource;
const selectIsNativeDialogOpen = (state: RootState): boolean =>
  state.importWorkflow.isNativeDialogOpen;

const selectIsSourceDragActive = (state: RootState): boolean =>
  state.importWorkflow.isSourceDragActive;

const selectDropListenerError = (state: RootState): AppError | null =>
  state.importWorkflow.dropListenerError;

export {
  dropListenerErrorCleared,
  dropListenerFailed,
  importWorkflowReducer,
  nativeDialogStateChanged,
  selectDropListenerError,
  selectIsChoosingSource,
  selectIsNativeDialogOpen,
  selectIsSourceDragActive,
  sourceChoiceFinished,
  sourceChoiceStarted,
  sourceDragChanged,
};
