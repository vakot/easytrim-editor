import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { importQueueItemActivated } from "@/app/store/actions/imported-queue-actions";
import { sourceCleared, sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { resolveEditorSnapshotTrim } from "@/domain/editor-snapshot";
import { createFullTrimRange, isValidTrimRange, type TrimRange } from "@/domain/trim";

import type { RootState } from "../store";

interface TrimState {
  value: TrimRange | null;
}

export const initialTrimState: TrimState = { value: null };

const trimSlice = createSlice({
  name: "trim",
  initialState: initialTrimState,
  reducers: {
    trimChanged: (state, action: PayloadAction<{ trim: TrimRange }>) => {
      if (!isValidTrimRange(action.payload.trim)) return;
      if (state.value?.sourceDurationMicros !== action.payload.trim.sourceDurationMicros) return;
      state.value = action.payload.trim;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sourceSelected, (state) => {
        state.value = null;
      })
      .addCase(importQueueItemActivated, (state, action) => {
        const { media } = action.payload;
        state.value = media
          ? resolveEditorSnapshotTrim(action.payload.snapshot.trim, media.durationMicros)
          : null;
      })
      .addCase(sourceCleared, (state) => {
        state.value = null;
      })
      .addCase(sourceReady, (state, action) => {
        state.value = action.payload.snapshot
          ? resolveEditorSnapshotTrim(
              action.payload.snapshot.trim,
              action.payload.media.durationMicros,
            )
          : createFullTrimRange(action.payload.media.durationMicros);
      });
  },
});

export const { trimChanged } = trimSlice.actions;
export const trimReducer = trimSlice.reducer;

export const selectTrim = (state: RootState): TrimRange | null => state.trim.value;
