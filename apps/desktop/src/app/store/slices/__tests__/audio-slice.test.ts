import { describe, expect, it } from "vitest";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import {
  audioMergeToggled,
  audioReducer,
  audioTrackToggled,
  audioTrackVolumeChanged,
  initialAudioState,
  masterAudioToggled,
  selectAudioTracks,
  waveformReady,
  waveformsLoading,
} from "../audio-slice";
import { firstSource, mediaWithAudio } from "./test-fixtures";

function readyAudio() {
  const loading = audioReducer(initialAudioState, sourceSelected({ source: firstSource }));
  return audioReducer(
    loading,
    sourceReady({ sourceId: firstSource.sourceId, media: mediaWithAudio(firstSource.sourceId) }),
  );
}

describe("audio slice", () => {
  it("initializes tracks and keeps audio configuration source-bound", () => {
    const ready = readyAudio();
    const muted = audioReducer(
      ready,
      audioTrackVolumeChanged({ sourceId: firstSource.sourceId, streamIndex: 2, volumePercent: 0 }),
    );
    const unmuted = audioReducer(
      muted,
      audioTrackToggled({ sourceId: firstSource.sourceId, streamIndex: 2 }),
    );
    const merged = audioReducer(unmuted, audioMergeToggled({ sourceId: firstSource.sourceId }));
    const masterMuted = audioReducer(
      merged,
      masterAudioToggled({ sourceId: firstSource.sourceId }),
    );

    expect(selectAudioTracks({ audio: ready } as never)).toHaveLength(2);
    expect(unmuted.tracks[0]).toMatchObject({ enabled: true, volumePercent: 50 });
    expect(merged.mergeAudio).toBe(true);
    expect(masterMuted.masterEnabled).toBe(false);
  });

  it("keeps only the current waveform job and auto-mutes default silent tracks", () => {
    const ready = readyAudio();
    const loading = audioReducer(
      ready,
      waveformsLoading({
        sourceId: firstSource.sourceId,
        jobId: "waveform-2",
        width: 1200,
        streamIndexes: [2, 4],
      }),
    );
    const stale = audioReducer(
      loading,
      waveformReady({
        status: "ready",
        sourceId: firstSource.sourceId,
        jobId: "waveform-1",
        streamIndex: 2,
        width: 800,
        url: "media://stale",
      }),
    );
    const current = audioReducer(
      stale,
      waveformReady({
        status: "ready",
        sourceId: firstSource.sourceId,
        jobId: "waveform-2",
        streamIndex: 2,
        width: 1200,
        hasSignal: false,
        url: "media://current",
      }),
    );

    expect(stale).toEqual(loading);
    expect(current.tracks[0]).toMatchObject({ enabled: false, volumePercent: 0 });
  });
});
