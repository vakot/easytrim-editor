import { describe, expect, it } from "vitest";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

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

function readyAudio() {
  const loading = audioReducer(initialAudioState, sourceSelected({ source: firstSource }));
  return audioReducer(
    loading,
    sourceReady({ loadToken: 1, media: mediaWithAudio(firstSource.sourcePath) }),
  );
}

describe("audio slice", () => {
  it("initializes tracks and keeps audio configuration source-bound", () => {
    const ready = readyAudio();
    const muted = audioReducer(
      ready,
      audioTrackVolumeChanged({ streamIndex: 2, volumePercent: 0 }),
    );
    const unmuted = audioReducer(muted, audioTrackToggled({ streamIndex: 2 }));
    const merged = audioReducer(unmuted, audioMergeToggled());
    const masterMuted = audioReducer(merged, masterAudioToggled());

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
        jobId: "waveform-2",
        width: 1200,
        streamIndexes: [2, 4],
      }),
    );
    const stale = audioReducer(
      loading,
      waveformReady({
        status: "ready",
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
