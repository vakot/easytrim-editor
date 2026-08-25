import type { AudioTrackState } from "@/app/store/slices/session-slice";

export function waveformStateWidth(track: AudioTrackState): number | null {
  return track.waveform.status === "idle" ? null : track.waveform.width;
}
