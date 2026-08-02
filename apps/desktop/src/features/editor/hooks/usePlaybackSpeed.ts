import { useState } from "react";

export const PLAYBACK_SPEED_STEPS = [0.5, 1, 1.5, 2, 3, 4, 5] as const;
export const DEFAULT_PLAYBACK_SPEED = 1;

export type PlaybackSpeed = (typeof PLAYBACK_SPEED_STEPS)[number];

export function usePlaybackSpeed() {
  const [speed, setSpeed] = useState<PlaybackSpeed>(DEFAULT_PLAYBACK_SPEED);

  return { speed, setSpeed };
}
