import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { editingInstanceActivated } from "@/app/store/actions/editing-instance-actions";
import { sourceCleared, sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { type CropRect, FULL_CROP } from "@/domain/crop";
import { rotateCrop, type RotationDegrees } from "@/domain/rotation";

import type { RootState } from "../store";

interface CropState {
  rotationDegrees: RotationDegrees;
  value: CropRect;
}

interface CropResolution {
  height: number;
  width: number;
}

export const initialCropState: CropState = { rotationDegrees: 0, value: FULL_CROP };

const cropSlice = createSlice({
  name: "crop",
  initialState: initialCropState,
  reducers: {
    cropChanged: (state, action: PayloadAction<{ crop: CropRect; resolution: CropResolution }>) => {
      state.value = action.payload.crop;
    },
    rotationChanged: (state, action: PayloadAction<RotationDegrees>) => {
      const currentRotation = state.rotationDegrees ?? 0;
      const delta = ((action.payload - currentRotation + 360) % 360) as RotationDegrees;
      state.value = rotateCrop(state.value, delta);
      state.rotationDegrees = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sourceSelected, (state) => {
        state.rotationDegrees = 0;
        state.value = FULL_CROP;
      })
      .addCase(editingInstanceActivated, (state, action) => {
        state.rotationDegrees = action.payload.snapshot.rotation ?? 0;
        state.value = action.payload.snapshot.crop ?? FULL_CROP;
      })
      .addCase(sourceCleared, (state) => {
        state.rotationDegrees = 0;
        state.value = FULL_CROP;
      })
      .addCase(sourceReady, (state, action) => {
        if (action.payload.snapshot) {
          state.rotationDegrees = action.payload.snapshot.rotation ?? 0;
          state.value = action.payload.snapshot.crop ?? FULL_CROP;
        }
      });
  },
});

export const { cropChanged, rotationChanged } = cropSlice.actions;
export const cropReducer = cropSlice.reducer;

const EMPTY_RESOLUTION: CropResolution = { width: 1, height: 1 };

export const selectCrop = (state: RootState): CropRect => state.crop.value;
export const selectRotationDegrees = (state: RootState): RotationDegrees =>
  state.crop.rotationDegrees ?? 0;
export function cropResolutionFor(
  sourceDimensions: CropResolution | null,
  crop: CropRect,
  rotation: RotationDegrees = 0,
): CropResolution {
  if (!sourceDimensions) return EMPTY_RESOLUTION;
  const sourceWidth =
    rotation === 90 || rotation === 270 ? sourceDimensions.height : sourceDimensions.width;
  const sourceHeight =
    rotation === 90 || rotation === 270 ? sourceDimensions.width : sourceDimensions.height;
  return {
    width: Math.max(1, Math.round(sourceWidth * crop.width)),
    height: Math.max(1, Math.round(sourceHeight * crop.height)),
  };
}

export const selectCropApplied = (state: RootState): boolean => {
  const crop = selectCrop(state);
  return crop.x !== 0 || crop.y !== 0 || crop.width !== 1 || crop.height !== 1;
};
export const selectCropResolution = createSelector(
  [selectSourceMedia, selectCrop, selectRotationDegrees],
  (media, crop, rotation): CropResolution =>
    cropResolutionFor(media?.video ?? null, crop, rotation),
);

export const selectRotationApplied = (state: RootState): boolean =>
  selectRotationDegrees(state) !== 0;
