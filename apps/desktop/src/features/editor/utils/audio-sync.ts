import { seekMediaIfNeeded } from "./media-sync";

export const PLAYING_AUDIO_HARD_RESYNC_THRESHOLD_SECONDS = 0.12;
export const PLAYING_AUDIO_DRIFT_TOLERANCE_SECONDS = 0.025;
const MAX_RATE_CORRECTION = 0.05;

export type AudioSyncAction = "none" | "rate" | "seek";

export function synchronizeAudioPosition(
  audio: HTMLMediaElement,
  targetSeconds: number,
  playbackRate: number,
  force: boolean,
): AudioSyncAction {
  const signedDriftSeconds = targetSeconds - audio.currentTime;
  const absoluteDriftSeconds = Math.abs(signedDriftSeconds);
  if (!force && audio.seeking) return "none";

  if (force || absoluteDriftSeconds >= PLAYING_AUDIO_HARD_RESYNC_THRESHOLD_SECONDS) {
    audio.playbackRate = playbackRate;
    seekMediaIfNeeded(audio, targetSeconds);
    return "seek";
  }

  if (absoluteDriftSeconds <= PLAYING_AUDIO_DRIFT_TOLERANCE_SECONDS) {
    if (audio.playbackRate !== playbackRate) audio.playbackRate = playbackRate;
    return "none";
  }

  const correction = Math.max(
    -MAX_RATE_CORRECTION,
    Math.min(MAX_RATE_CORRECTION, signedDriftSeconds * 0.5),
  );
  audio.playbackRate = playbackRate * (1 + correction);
  return "rate";
}
