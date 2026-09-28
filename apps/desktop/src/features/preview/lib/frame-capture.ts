import type { CropRect } from "@/domain/crop";
import type { RotationDegrees } from "@/domain/rotation";

import { sourceCropForRotation } from "./preview-geometry";

const QUARTER_TURN_DEGREES = [90, 270] as const;

function capturePreviewFrame(
  video: HTMLVideoElement,
  crop: CropRect,
  rotation: RotationDegrees,
  flipHorizontal: boolean,
  flipVertical: boolean,
): Promise<Blob> {
  if (
    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
    video.videoWidth <= 0 ||
    video.videoHeight <= 0
  )
    return Promise.reject(new Error("The preview frame is not ready."));

  const sourceCrop = sourceCropForRotation(crop, rotation);
  const sourceX = sourceCrop.x * video.videoWidth;
  const sourceY = sourceCrop.y * video.videoHeight;
  const sourceWidth = sourceCrop.width * video.videoWidth;
  const sourceHeight = sourceCrop.height * video.videoHeight;
  const quarterTurn = QUARTER_TURN_DEGREES.includes(rotation as 90 | 270);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(quarterTurn ? sourceHeight : sourceWidth));
  canvas.height = Math.max(1, Math.round(quarterTurn ? sourceWidth : sourceHeight));

  const context = canvas.getContext("2d");
  if (!context) return Promise.reject(new Error("The frame could not be prepared as an image."));

  context.translate(canvas.width / 2, canvas.height / 2);
  context.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1);
  context.rotate((rotation * Math.PI) / 180);
  context.drawImage(
    video,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    -sourceWidth / 2,
    -sourceHeight / 2,
    sourceWidth,
    sourceHeight,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The frame could not be encoded as a PNG image."));
    }, "image/png");
  });
}

export { capturePreviewFrame };
