import { useLayoutEffect, useRef, useState } from "react";

import type { RotationDegrees } from "@/domain/rotation";

import {
  advanceRotationPresentation,
  initialRotationPresentation,
} from "../../../lib/rotation-presentation";

function useContinuousRotation(rotation: RotationDegrees, reduceMotion: boolean): number {
  const [presentation, setPresentation] = useState(() => initialRotationPresentation(rotation));
  const presentationRef = useRef(presentation);

  useLayoutEffect(() => {
    const nextPresentation = advanceRotationPresentation(
      presentationRef.current,
      rotation,
      reduceMotion,
    );

    presentationRef.current = nextPresentation;
    setPresentation(nextPresentation);
  }, [reduceMotion, rotation]);

  return presentation.angle;
}

export { useContinuousRotation };
