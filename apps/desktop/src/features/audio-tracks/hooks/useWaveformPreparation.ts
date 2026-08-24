import { useEffect, useRef } from "react";

import type { AudioTrackState } from "@/app/session-state";

export const WAVEFORM_RENDER_WIDTH = 4096;

export function useWaveformPreparation(
  tracks: AudioTrackState[],
  enabled: boolean,
  prepare: (streamIndexes: number[], width: number) => void,
) {
  const lastRequestRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const pending = tracks
      .filter((track) => track.waveform.status === "idle")
      .map((track) => track.streamIndex);
    if (pending.length === 0) {
      lastRequestRef.current = null;
      return;
    }

    const requestKey = `${WAVEFORM_RENDER_WIDTH}:${pending.join(",")}`;
    if (lastRequestRef.current === requestKey) {
      return;
    }
    lastRequestRef.current = requestKey;
    prepare(pending, WAVEFORM_RENDER_WIDTH);
  }, [enabled, prepare, tracks]);
}
