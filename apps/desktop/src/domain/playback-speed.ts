export const PLAYBACK_SPEED_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3] as const;
export const DEFAULT_PLAYBACK_SPEED = 1;
export const MIN_PLAYBACK_SPEED = 0.25;
export const MAX_PLAYBACK_SPEED = 100;
export const MAX_AUDIO_PLAYBACK_SPEED = 5;

export type PlaybackSpeed = number;

export function isAudioPlaybackEnabled(speed: PlaybackSpeed): boolean {
  return speed <= MAX_AUDIO_PLAYBACK_SPEED;
}

export function normalizePlaybackSpeed(value: number): PlaybackSpeed | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.min(MAX_PLAYBACK_SPEED, Math.max(MIN_PLAYBACK_SPEED, value));
}

export function getPlaybackSpeedStepIndex(speed: PlaybackSpeed): number {
  return PLAYBACK_SPEED_STEPS.reduce((closestIndex, candidate, index) => {
    const closestSpeed = PLAYBACK_SPEED_STEPS[closestIndex] ?? speed;
    return Math.abs(candidate - speed) < Math.abs(closestSpeed - speed) ? index : closestIndex;
  }, 0);
}
