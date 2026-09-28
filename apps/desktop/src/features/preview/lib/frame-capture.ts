import type { CropRect } from "@/domain/crop";
import type { FrameRate } from "@/domain/media";
import type { RotationDegrees } from "@/domain/rotation";

import { sourceCropForRotation } from "./preview-geometry";

const QUARTER_TURN_DEGREES = [90, 270] as const;

function frameNumberAt(currentTimeSeconds: number, frameRate: FrameRate | undefined): number {
  const time = Number.isFinite(currentTimeSeconds) ? Math.max(0, currentTimeSeconds) : 0;
  const numerator = frameRate?.numerator ?? 10;
  const denominator = frameRate?.denominator ?? 1;
  if (numerator <= 0 || denominator <= 0) return Math.round(time * 10);
  return Math.round((time * numerator) / denominator);
}

function frameFileNameFor(displayName: string, frameNumber: number): string {
  const baseName = displayName.split(/[\\/]/).at(-1) ?? "";
  const extensionIndex = baseName.lastIndexOf(".");
  const withoutExtension = extensionIndex > 0 ? baseName.slice(0, extensionIndex) : baseName;
  const cleanedBase = Array.from(withoutExtension, (character) =>
    character.charCodeAt(0) < 32 ? "_" : character,
  )
    .join("")
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/[ .]+$/g, "")
    .trim();

  const suffix = `_${Math.max(0, Math.round(frameNumber))}.png`;
  const safeBase = cleanedBase || "frame";
  let truncatedBase = "";

  for (const character of safeBase) {
    if (truncatedBase.length + character.length + suffix.length > 255) break;
    truncatedBase += character;
  }

  return `${truncatedBase || "frame"}${suffix}`;
}

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

export { capturePreviewFrame, frameFileNameFor, frameNumberAt };
