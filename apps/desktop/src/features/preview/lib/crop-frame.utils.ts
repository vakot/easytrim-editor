import type { CropRect } from "./crop-geometry.utils";

interface Bounds {
  height: number;
  width: number;
}

interface CropFrame {
  height: number;
  left: number;
  top: number;
  width: number;
}

interface ScaledFrame {
  frame: Bounds;
  scale: number;
}

function centerFrame(bounds: Bounds, size: Bounds): CropFrame {
  return {
    width: size.width,
    height: size.height,
    left: bounds.width / 2 - size.width / 2,
    top: bounds.height / 2 - size.height / 2,
  };
}

function cropFrame(viewport: CropFrame, crop: CropRect): CropFrame {
  return {
    width: viewport.width * crop.width,
    height: viewport.height * crop.height,
    left: viewport.left + viewport.width * crop.x,
    top: viewport.top + viewport.height * crop.y,
  };
}

/**
 * Keep the preview video at or below its intrinsic pixel dimensions. Any
 * required enlargement is applied by the compositor instead of by laying out
 * an unnecessarily large video element.
 */
function scaleFrameToSourceBounds(frame: Bounds, source: Bounds): ScaledFrame {
  if (frame.width <= 0 || frame.height <= 0 || source.width <= 0 || source.height <= 0)
    return { frame, scale: 1 };

  const scale = Math.min(1, source.width / frame.width, source.height / frame.height);
  return {
    frame: { width: frame.width * scale, height: frame.height * scale },
    scale,
  };
}

export { centerFrame, cropFrame, scaleFrameToSourceBounds };

export type { Bounds, CropFrame, ScaledFrame };
