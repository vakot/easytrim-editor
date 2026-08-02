import { seekMediaIfNeeded } from "./media-sync";

export const PLAYING_AUDIO_RESYNC_THRESHOLD_SECONDS = 0.5;

export function synchronizeAudioPosition(
  audio: HTMLMediaElement,
  targetSeconds: number,
  force: boolean,
): boolean {
  const driftSeconds = Math.abs(audio.currentTime - targetSeconds);
  if (!force && (audio.seeking || driftSeconds < PLAYING_AUDIO_RESYNC_THRESHOLD_SECONDS)) {
    return false;
  }

  seekMediaIfNeeded(audio, targetSeconds);
  return true;
}
