export {
  DEFAULT_PLAYBACK_SPEED,
  PLAYBACK_SPEED_STEPS,
  type PlaybackSpeed,
} from "@/domain/playback-speed";

import type { PlaybackSpeed } from "@/domain/playback-speed";

export function usePlaybackSpeed(speed: PlaybackSpeed, setSpeed: (speed: PlaybackSpeed) => void) {
  return { speed, setSpeed };
}
