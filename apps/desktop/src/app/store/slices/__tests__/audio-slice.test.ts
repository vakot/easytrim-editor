import { describe, expect, it } from "vitest";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { trimChanged } from "@/app/store/slices/trim-slice";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

import {
  audioMergeToggled,
  audioReducer,
  audioTrackActivityAnalysisStarted,
  audioTrackGainChanged,
  audioTrackLoudnessAnalysisStarted,
  audioTrackToggled,
  initialAudioState,
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
    const adjusted = audioReducer(ready, audioTrackGainChanged({ streamIndex: 2, gainDb: -3.5 }));
    const muted = audioReducer(adjusted, audioTrackToggled({ streamIndex: 2 }));
    const unmuted = audioReducer(muted, audioTrackToggled({ streamIndex: 2 }));
    const merged = audioReducer(unmuted, audioMergeToggled());

    expect(selectAudioTracks({ audio: ready } as never)).toHaveLength(2);
    expect(unmuted.tracks[0]).toMatchObject({ enabled: true, processing: { gainDb: -3.5 } });
    expect(merged.mergeAudio).toBe(true);
    expect(ready.tracks[0]?.processing.gainDb).toBe(0);
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
    expect(current.tracks[0]).toMatchObject({ enabled: false, processing: { gainDb: 0 } });
  });

  it("invalidates only affected track analyses and clears trim-bound loudness results", () => {
    let state = readyAudio();
    state = audioReducer(
      state,
      audioTrackLoudnessAnalysisStarted({ operationId: "loudness-2", streamIndex: 2 }),
    );
    state = audioReducer(
      state,
      audioTrackActivityAnalysisStarted({ operationId: "activity-2", streamIndex: 2 }),
    );
    state = audioReducer(
      state,
      audioTrackLoudnessAnalysisStarted({ operationId: "loudness-4", streamIndex: 4 }),
    );
    state = audioReducer(
      state,
      audioTrackActivityAnalysisStarted({ operationId: "activity-4", streamIndex: 4 }),
    );

    const adjusted = audioReducer(state, audioTrackGainChanged({ streamIndex: 2, gainDb: -2 }));
    expect(adjusted.tracks[0]).toMatchObject({
      activityAnalysis: { status: "idle" },
      loudnessAnalysis: { status: "idle" },
    });
    expect(adjusted.tracks[1]).toMatchObject({
      activityAnalysis: { operationId: "activity-4", status: "loading" },
      loudnessAnalysis: { operationId: "loudness-4", status: "loading" },
    });

    const trimmed = audioReducer(
      adjusted,
      trimChanged({
        trim: { endMicros: 4_000_000, sourceDurationMicros: 5_000_000, startMicros: 0 },
      }),
    );

    expect(trimmed.tracks.map(({ loudnessAnalysis }) => loudnessAnalysis.status)).toEqual([
      "idle",
      "idle",
    ]);
    expect(trimmed.tracks[1]?.activityAnalysis).toMatchObject({ status: "loading" });
  });
});
