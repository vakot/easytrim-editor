import { describe, expect, it } from "vitest";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { trimChanged } from "@/app/store/slices/trim-slice";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

import {
  audioMergeToggled,
  audioPreviewsReady,
  audioReducer,
  audioTrackActivityAnalysisStarted,
  audioTrackGainChanged,
  audioTrackLoudnessAnalysisReady,
  audioTrackLoudnessAnalysisStarted,
  audioTrackPlaybackPreviewUrl,
  audioTrackPreviewFailed,
  audioTrackPreviewReady,
  audioTrackPreviewStarted,
  audioTrackProcessingChanged,
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

  it("keeps loudness analysis independent from manual gain and clears trim-bound results", () => {
    let state = readyAudio();
    state = audioReducer(
      state,
      audioTrackLoudnessAnalysisStarted({
        cacheKey: "analysis-2",
        operationId: "loudness-2",
        streamIndex: 2,
      }),
    );
    state = audioReducer(
      state,
      audioTrackLoudnessAnalysisReady({
        cacheKey: "analysis-2",
        operationId: "loudness-2",
        result: { integratedLufs: -18, truePeakDb: -4 },
        streamIndex: 2,
      }),
    );
    state = audioReducer(
      state,
      audioTrackActivityAnalysisStarted({ operationId: "activity-2", streamIndex: 2 }),
    );
    state = audioReducer(
      state,
      audioTrackLoudnessAnalysisStarted({
        cacheKey: "analysis-4",
        operationId: "loudness-4",
        streamIndex: 4,
      }),
    );
    state = audioReducer(
      state,
      audioTrackActivityAnalysisStarted({ operationId: "activity-4", streamIndex: 4 }),
    );

    const adjusted = audioReducer(state, audioTrackGainChanged({ streamIndex: 2, gainDb: -2 }));
    expect(adjusted.tracks[0]).toMatchObject({
      activityAnalysis: { status: "idle" },
      loudnessAnalysis: { cacheKey: "analysis-2", status: "ready" },
    });
    expect(adjusted.tracks[1]).toMatchObject({
      activityAnalysis: { operationId: "activity-4", status: "loading" },
      loudnessAnalysis: { operationId: "loudness-4", status: "loading" },
    });

    const normalized = audioReducer(
      adjusted,
      audioTrackProcessingChanged({
        streamIndex: 2,
        processing: { gainDb: -2, loudnessNormalization: "broadcast" },
      }),
    );

    expect(normalized.tracks[0]?.loudnessAnalysis).toMatchObject({
      cacheKey: "analysis-2",
      status: "ready",
    });

    const trimmed = audioReducer(
      normalized,
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

  it("keeps dormant manual gain changes from invalidating normalized activity or preview", () => {
    let state = readyAudio();
    state = audioReducer(
      state,
      audioTrackProcessingChanged({
        streamIndex: 2,
        processing: { gainDb: -4, loudnessNormalization: "streaming" },
      }),
    );
    state = audioReducer(
      state,
      audioTrackLoudnessAnalysisStarted({
        cacheKey: "analysis-2",
        operationId: "loudness-2",
        streamIndex: 2,
      }),
    );
    state = audioReducer(
      state,
      audioTrackActivityAnalysisStarted({ operationId: "activity-2", streamIndex: 2 }),
    );
    state = audioReducer(
      state,
      audioTrackPreviewStarted({ operationId: "preview-2", streamIndex: 2 }),
    );
    const normalized = audioReducer(
      state,
      audioTrackPreviewReady({
        operationId: "preview-2",
        descriptor: {
          mediaToken: 1,
          previewRevision: 2,
          processing: { gainDb: 0, loudnessNormalization: "streaming" },
          streamIndex: 2,
          url: "media://normalized",
        },
      }),
    );

    const gainChanged = audioReducer(
      normalized,
      audioTrackGainChanged({ streamIndex: 2, gainDb: 7 }),
    );

    expect(gainChanged.tracks[0]).toMatchObject({
      activityAnalysis: { operationId: "activity-2", status: "loading" },
      loudnessAnalysis: { operationId: "loudness-2", status: "loading" },
      preview: { status: "ready", descriptor: { url: "media://normalized" } },
      processing: { gainDb: 7, loudnessNormalization: "streaming" },
    });
  });

  it("keeps a newer per-track preview when initial preparation finishes out of order", () => {
    let state = readyAudio();
    state = audioReducer(
      state,
      audioTrackPreviewStarted({ operationId: "preview-new", streamIndex: 2 }),
    );
    state = audioReducer(
      state,
      audioTrackPreviewReady({
        operationId: "preview-new",
        descriptor: {
          mediaToken: 1,
          previewRevision: 3,
          processing: { gainDb: 0 },
          streamIndex: 2,
          url: "media://newer",
        },
      }),
    );

    state = audioReducer(
      state,
      audioPreviewsReady({
        previews: [
          {
            mediaToken: 1,
            previewRevision: 2,
            processing: { gainDb: 0 },
            streamIndex: 2,
            url: "media://older",
          },
        ],
      }),
    );

    expect(state.tracks[0]?.preview).toMatchObject({
      descriptor: { previewRevision: 3, url: "media://newer" },
      status: "ready",
    });
  });

  it("keeps the prior normalized preview available while rejecting a stale trim job", () => {
    let state = audioReducer(
      readyAudio(),
      audioTrackProcessingChanged({
        streamIndex: 2,
        processing: { gainDb: 0, loudnessNormalization: "streaming" },
      }),
    );

    state = audioReducer(state, audioTrackPreviewStarted({ operationId: "old", streamIndex: 2 }));
    state = audioReducer(
      state,
      audioTrackPreviewReady({
        operationId: "old",
        descriptor: {
          mediaToken: 1,
          previewRevision: 1,
          processing: { gainDb: 0, loudnessNormalization: "streaming" },
          streamIndex: 2,
          url: "media://prior-trim",
        },
      }),
    );
    state = audioReducer(
      state,
      trimChanged({
        trim: { endMicros: 4_000_000, sourceDurationMicros: 5_000_000, startMicros: 100_000 },
      }),
    );
    expect(state.tracks[0]?.preview).toMatchObject({
      descriptor: { url: "media://prior-trim" },
      status: "stale",
    });
    expect(audioTrackPlaybackPreviewUrl(state.tracks[0]!, true)).toBe("media://prior-trim");

    state = audioReducer(
      state,
      audioPreviewsReady({
        previews: [
          {
            mediaToken: 1,
            previewRevision: 0,
            processing: { gainDb: 0, loudnessNormalization: "streaming" },
            streamIndex: 2,
            url: "media://stale-initial-job",
          },
        ],
      }),
    );
    expect(state.tracks[0]?.preview).toMatchObject({
      descriptor: { url: "media://prior-trim" },
      status: "stale",
    });

    state = audioReducer(state, audioTrackPreviewStarted({ operationId: "new", streamIndex: 2 }));
    state = audioReducer(
      state,
      audioTrackPreviewReady({
        operationId: "old",
        descriptor: {
          mediaToken: 1,
          previewRevision: 2,
          processing: { gainDb: 0, loudnessNormalization: "streaming" },
          streamIndex: 2,
          url: "media://stale-trim",
        },
      }),
    );

    expect(state.tracks[0]?.preview).toMatchObject({
      descriptor: { url: "media://prior-trim" },
      operationId: "new",
      status: "loading",
    });
    expect(audioTrackPlaybackPreviewUrl(state.tracks[0]!, true)).toBe("media://prior-trim");
    expect(audioTrackPlaybackPreviewUrl(state.tracks[0]!, false)).toBeUndefined();
  });

  it("marks an outdated fallback failed when its replacement cannot be prepared", () => {
    let state = audioReducer(
      readyAudio(),
      audioTrackProcessingChanged({
        streamIndex: 2,
        processing: { gainDb: 0, loudnessNormalization: "streaming" },
      }),
    );

    state = audioReducer(state, audioTrackPreviewStarted({ operationId: "prior", streamIndex: 2 }));
    state = audioReducer(
      state,
      audioTrackPreviewReady({
        operationId: "prior",
        descriptor: {
          mediaToken: 1,
          previewRevision: 1,
          processing: { gainDb: 0, loudnessNormalization: "streaming" },
          streamIndex: 2,
          url: "media://old-processing",
        },
      }),
    );
    state = audioReducer(
      state,
      audioTrackProcessingChanged({ streamIndex: 2, processing: { gainDb: 0 } }),
    );
    state = audioReducer(
      state,
      audioTrackPreviewStarted({ operationId: "replacement", streamIndex: 2 }),
    );
    state = audioReducer(
      state,
      audioTrackPreviewFailed({
        error: { code: "internal", message: "preview failed" },
        operationId: "replacement",
        streamIndex: 2,
      }),
    );

    expect(state.tracks[0]?.preview).toMatchObject({
      descriptor: { url: "media://old-processing" },
      operationId: "replacement",
      status: "failed",
    });
    expect(audioTrackPlaybackPreviewUrl(state.tracks[0]!, true)).toBeUndefined();
  });
});
