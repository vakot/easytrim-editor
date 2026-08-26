import { createFullTrimRange, isValidTrimRange, type TrimRange } from "@/domain/trim";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import {
  sourceCleared,
  sourceFailed,
  sourceReady,
  sourceSelected,
} from "@/app/store/actions/source-actions";
import type { RootState } from "../store";

export interface TrimState {
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
      .addCase(sourceCleared, (state) => {
        state.value = null;
      })
      .addCase(sourceFailed, (state) => {
        state.value = null;
      })
      .addCase(sourceReady, (state, action) => {
        state.value = createFullTrimRange(action.payload.media.durationMicros);
      });
  },
});

export const { trimChanged } = trimSlice.actions;
export const trimReducer = trimSlice.reducer;

export const selectTrim = (state: RootState): TrimRange | null => state.trim.value;
export const selectTrimStart = (state: RootState): number => state.trim.value?.startMicros ?? 0;
export const selectTrimEnd = (state: RootState): number => state.trim.value?.endMicros ?? 0;
