import type { RotationDegrees } from "@/domain/rotation";

interface RotationPresentation {
  angle: number;
  rotation: RotationDegrees;
}

function initialRotationPresentation(rotation: RotationDegrees): RotationPresentation {
  return { angle: rotation, rotation };
}

function advanceRotationPresentation(
  current: RotationPresentation,
  nextRotation: RotationDegrees,
  reduceMotion: boolean,
): RotationPresentation {
  if (reduceMotion) return initialRotationPresentation(nextRotation);
  if (current.rotation === nextRotation) return current;

  const clockwiseDelta = (nextRotation - current.rotation + 360) % 360;
  const delta = clockwiseDelta === 270 ? -90 : clockwiseDelta;

  return { angle: current.angle + delta, rotation: nextRotation };
}

export { advanceRotationPresentation, initialRotationPresentation };
export type { RotationPresentation };
