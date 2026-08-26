import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { sourceCleared, sourceFailed, sourceSelected } from "@/app/store/actions/source-actions";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { FULL_CROP, type CropRect } from "@/domain/crop";
import type { RootState } from "../store";

export interface CropState {
  value: CropRect;
}

export interface CropResolution {
  width: number;
  height: number;
}

export const initialCropState: CropState = { value: FULL_CROP };

const cropSlice = createSlice({
  name: "crop",
  initialState: initialCropState,
  reducers: {
    cropChanged: (state, action: PayloadAction<{ crop: CropRect; resolution: CropResolution }>) => {
      state.value = action.payload.crop;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sourceSelected, (state) => {
        state.value = FULL_CROP;
      })
      .addCase(sourceCleared, (state) => {
        state.value = FULL_CROP;
      })
      .addCase(sourceFailed, (state) => {
        state.value = FULL_CROP;
      });
  },
});

export const { cropChanged } = cropSlice.actions;
export const cropReducer = cropSlice.reducer;

const EMPTY_RESOLUTION: CropResolution = { width: 1, height: 1 };

export const selectCrop = (state: RootState): CropRect => state.crop.value;
export function cropResolutionFor(
  sourceDimensions: CropResolution | null,
  crop: CropRect,
): CropResolution {
  if (!sourceDimensions) return EMPTY_RESOLUTION;
  return {
    width: Math.max(1, Math.round(sourceDimensions.width * crop.width)),
    height: Math.max(1, Math.round(sourceDimensions.height * crop.height)),
  };
}

export const selectCropApplied = (state: RootState): boolean => {
  const crop = selectCrop(state);
  return crop.x !== 0 || crop.y !== 0 || crop.width !== 1 || crop.height !== 1;
};
export const selectCropResolution = createSelector(
  [selectSourceMedia, selectCrop],
  (media, crop): CropResolution => cropResolutionFor(media?.video ?? null, crop),
);
