import { useEffect } from "react";

import type { AudioTrackState } from "@/app/session-state";

export const WAVEFORM_RENDER_WIDTH = 4096;

export function useWaveformPreparation(
  tracks: AudioTrackState[],
  prepare: (streamIndexes: number[], width: number) => void,
) {
  useEffect(() => {
    const pending = tracks
      .filter((track) => track.waveform.status === "idle")
      .map((track) => track.streamIndex);
    if (pending.length > 0) prepare(pending, WAVEFORM_RENDER_WIDTH);
  }, [prepare, tracks]);
}
