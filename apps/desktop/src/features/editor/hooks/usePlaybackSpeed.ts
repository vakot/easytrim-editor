import { useState } from "react";

export const PLAYBACK_SPEED_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3] as const;
export const DEFAULT_PLAYBACK_SPEED = 1;

export type PlaybackSpeed = (typeof PLAYBACK_SPEED_STEPS)[number];

export function usePlaybackSpeed() {
  const [speed, setSpeed] = useState<PlaybackSpeed>(DEFAULT_PLAYBACK_SPEED);

  return { speed, setSpeed };
}
