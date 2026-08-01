import type { AudioTrackState } from "@/app/session-state";

export function waveformStateWidth(track: AudioTrackState): number | null {
  return track.waveform.status === "idle" ? null : track.waveform.width;
}
