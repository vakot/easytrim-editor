import { useState } from "react";

import type { CropRect } from "@/domain/crop";
import type { RotationDegrees } from "@/domain/rotation";

import {
  advanceRotationPresentation,
  initialRotationPresentation,
} from "../../../lib/rotation-presentation";

interface PreviewPresentationInput {
  crop: CropRect;
  cropIsOpen: boolean;
  flipHorizontal: boolean;
  flipVertical: boolean;
  rotation: RotationDegrees;
}

interface RotationTarget {
  angle: number;
  rotation: RotationDegrees;
  sourceLoadToken: number;
}

function usePreviewPresentation(
  input: PreviewPresentationInput,
  sourceLoadToken: number,
  reduceMotion: boolean,
) {
  const [rotationTarget, setRotationTarget] = useState<RotationTarget>(() => ({
    ...initialRotationPresentation(input.rotation),
    sourceLoadToken,
  }));

  const nextTarget =
    rotationTarget.sourceLoadToken === sourceLoadToken
      ? advanceRotationPresentation(rotationTarget, input.rotation, reduceMotion)
      : initialRotationPresentation(input.rotation);

  const nextTargetWithSource = { ...nextTarget, sourceLoadToken };

  if (
    rotationTarget.sourceLoadToken !== sourceLoadToken ||
    rotationTarget.angle !== nextTarget.angle ||
    rotationTarget.rotation !== nextTarget.rotation
  )
    setRotationTarget(nextTargetWithSource);

  return { ...input, rotationAngle: nextTarget.angle };
}

export { usePreviewPresentation };
