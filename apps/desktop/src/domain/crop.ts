export interface CropRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export const FULL_CROP: CropRect = { x: 0, y: 0, width: 1, height: 1 };
