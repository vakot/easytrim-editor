import { useState } from "react";

import type { RotationDegrees } from "@/domain/rotation";

import {
  advanceRotationPresentation,
  initialRotationPresentation,
} from "../../../lib/rotation-presentation";

function useContinuousRotation(rotation: RotationDegrees, reduceMotion: boolean): number {
  const [presentation, setPresentation] = useState(() => initialRotationPresentation(rotation));

  if (presentation.rotation !== rotation || (reduceMotion && presentation.angle !== rotation)) {
    setPresentation(advanceRotationPresentation(presentation, rotation, reduceMotion));
  }

  return presentation.angle;
}

export { useContinuousRotation };
