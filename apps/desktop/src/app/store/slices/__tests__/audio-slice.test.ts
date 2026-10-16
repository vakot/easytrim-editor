import { describe, expect, it } from "vitest";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { trimChanged } from "@/app/store/slices/trim-slice";
import { createEditorSnapshot } from "@/domain/editor-snapshot";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

import {
  audioReducer,
  audioTrackActivityAnalysisStarted,
  audioTrackDefaultChanged,
  audioTrackFiltersApplied,
  audioTrackLoudnessAnalysisReady,
  audioTrackLoudnessAnalysisStarted,
  audioTrackToggled,
  audioTrackVolumeChanged,
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
    const adjusted = audioReducer(ready, audioTrackVolumeChanged({ streamIndex: 2, volume: 3.5 }));
    const muted = audioReducer(adjusted, audioTrackToggled({ streamIndex: 2 }));
    const unmuted = audioReducer(muted, audioTrackToggled({ streamIndex: 2 }));

    expect(selectAudioTracks({ audio: ready } as never)).toHaveLength(2);
    expect(unmuted.tracks[0]).toMatchObject({ enabled: true, processing: { volume: 3.5 } });
    expect(ready.tracks[0]?.processing).toEqual({ filters: [], volume: 1 });
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
    expect(current.tracks[0]).toMatchObject({ enabled: false, processing: { volume: 1 } });
    expect(current.tracks[0]?.metadata.isDefault).toBe(false);
    expect(current.tracks[0]?.waveform).toMatchObject({ status: "ready", url: "media://current" });
    expect(current.tracks[1]?.metadata.isDefault).toBe(true);
  });

  it("keeps a track enabled when its filters make the processed waveform silent", () => {
    const filtered = audioReducer(
      readyAudio(),
      audioTrackFiltersApplied({
        streamIndex: 2,
        filters: [{ enabled: true, id: "g", type: "gain", gainDb: -60 }],
      }),
    );

    const loading = audioReducer(
      filtered,
      waveformsLoading({ jobId: "waveform-1", width: 1200, streamIndexes: [2] }),
    );

    const silent = audioReducer(
      loading,
      waveformReady({
        status: "ready",
        jobId: "waveform-1",
        streamIndex: 2,
        width: 1200,
        hasSignal: false,
        url: "media://silent",
      }),
    );

    expect(silent.tracks[0]).toMatchObject({ enabled: true, metadata: { isDefault: true } });
    expect(silent.tracks[0]?.waveform).toMatchObject({ status: "ready", url: "media://silent" });
  });

  it("restores one enabled default when an older snapshot disables the source default", () => {
    const snapshot = createEditorSnapshot({
      source: firstSource,
      trim: { kind: "full-source" },
      crop: null,
      audioTracks: [
        { enabled: false, streamIndex: 2, metadata: {}, processing: { filters: [], volume: 1 } },
        {
          enabled: true,
          streamIndex: 4,
          metadata: { language: "ru" },
          processing: { filters: [], volume: 1 },
        },
      ],
    });

    const restored = audioReducer(
      initialAudioState,
      sourceReady({ loadToken: 1, media: mediaWithAudio(firstSource.sourcePath), snapshot }),
    );

    expect(
      restored.tracks.map(({ enabled, metadata }) => ({
        enabled,
        isDefault: metadata.isDefault,
      })),
    ).toEqual([
      { enabled: false, isDefault: false },
      { enabled: true, isDefault: true },
    ]);
    expect(restored.tracks[1]?.metadata.language).toBe("rus");
  });

  it("keeps exactly one enabled default after default-track changes", () => {
    const state = audioReducer(readyAudio(), audioTrackDefaultChanged({ streamIndex: 4 }));
    expect(
      state.tracks.map(({ enabled, metadata }) => ({ enabled, isDefault: metadata.isDefault })),
    ).toEqual([
      { enabled: true, isDefault: false },
      { enabled: true, isDefault: true },
    ]);
  });

  it("keeps analyses when only Track Volume changes and clears trim-bound results", () => {
    let state = readyAudio();
    state = audioReducer(
      state,
      audioTrackFiltersApplied({
        filters: [
          {
            enabled: true,
            id: "norm",
            loudnessRangeLu: 11,
            maxTruePeakDb: -1.5,
            targetLufs: -16,
            type: "loudnessNormalization",
          },
        ],
        streamIndex: 2,
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
      audioTrackLoudnessAnalysisReady({
        cacheKey: "analysis-2",
        operationId: "loudness-2",
        result: [{ filterId: "norm", integratedLufs: -18, truePeakDb: -4 }],
        streamIndex: 2,
      }),
    );
    state = audioReducer(
      state,
      audioTrackActivityAnalysisStarted({ operationId: "activity-2", streamIndex: 2 }),
    );

    const adjusted = audioReducer(state, audioTrackVolumeChanged({ streamIndex: 2, volume: 0.5 }));
    expect(adjusted.tracks[0]).toMatchObject({
      activityAnalysis: { operationId: "activity-2", status: "loading" },
      loudnessAnalysis: { cacheKey: "analysis-2", status: "ready" },
      processing: { volume: 0.5 },
    });

    const trimmed = audioReducer(
      adjusted,
      trimChanged({
        trim: { endMicros: 4_000_000, sourceDurationMicros: 5_000_000, startMicros: 0 },
      }),
    );

    expect(trimmed.tracks[0]?.loudnessAnalysis).toEqual({ status: "idle" });
  });

  it("ignores Track Volume outside 0-500%", () => {
    const state = readyAudio();
    expect(audioReducer(state, audioTrackVolumeChanged({ streamIndex: 2, volume: 5.01 }))).toBe(
      state,
    );
  });

  it("invalidates only the analyses whose inputs an applied chain changes", () => {
    const normalization = {
      enabled: true,
      id: "norm",
      loudnessRangeLu: 11,
      maxTruePeakDb: -1.5,
      targetLufs: -16,
      type: "loudnessNormalization" as const,
    };

    let state = audioReducer(
      readyAudio(),
      audioTrackFiltersApplied({
        filters: [{ enabled: true, cutoffHz: 80, id: "hp", type: "highPass" }, normalization],
        streamIndex: 2,
      }),
    );

    state = audioReducer(
      state,
      waveformsLoading({ jobId: "waveform-1", streamIndexes: [2], width: 800 }),
    );
    state = audioReducer(
      state,
      waveformReady({
        jobId: "waveform-1",
        status: "ready",
        streamIndex: 2,
        url: "media://waveform",
        width: 800,
      }),
    );
    state = audioReducer(
      state,
      audioTrackLoudnessAnalysisStarted({ cacheKey: "k", operationId: "o", streamIndex: 2 }),
    );
    state = audioReducer(
      state,
      audioTrackLoudnessAnalysisReady({
        cacheKey: "k",
        operationId: "o",
        result: [],
        streamIndex: 2,
      }),
    );

    const downstream = audioReducer(
      state,
      audioTrackFiltersApplied({
        filters: [
          { enabled: true, cutoffHz: 80, id: "hp", type: "highPass" },
          { ...normalization, targetLufs: -23 },
          { enabled: true, attackMs: 5, ceilingDb: -1, id: "lim", releaseMs: 50, type: "limiter" },
        ],
        streamIndex: 2,
      }),
    );

    expect(downstream.tracks[0]?.loudnessAnalysis).toMatchObject({ status: "ready" });
    expect(downstream.tracks[0]?.waveform).toEqual({ status: "idle" });
    expect(downstream.tracks[0]?.activityAnalysis).toEqual({ status: "idle" });

    const upstream = audioReducer(
      downstream,
      audioTrackFiltersApplied({
        filters: [{ enabled: true, cutoffHz: 100, id: "hp", type: "highPass" }, normalization],
        streamIndex: 2,
      }),
    );

    expect(upstream.tracks[0]?.loudnessAnalysis).toEqual({ status: "idle" });
    expect(upstream.tracks[0]?.waveform).toEqual({ status: "idle" });
  });

  it("rejects an invalid chain atomically", () => {
    const state = audioReducer(
      readyAudio(),
      audioTrackFiltersApplied({
        filters: [{ enabled: true, gainDb: 3, id: "keep", type: "gain" }],
        streamIndex: 2,
      }),
    );

    const rejected = audioReducer(
      state,
      audioTrackFiltersApplied({
        filters: [
          { enabled: true, gainDb: 3, id: "dup", type: "gain" },
          { enabled: true, gainDb: 99, id: "dup", type: "gain" },
        ],
        streamIndex: 2,
      }),
    );

    expect(rejected).toBe(state);
  });
  it("invalidates every committed filter change, but preserves pre-volume waveforms", () => {
    const a = { enabled: true, id: "gain", type: "gain" as const, gainDb: 6 };
    const b = { enabled: true, id: "hp", type: "highPass" as const, cutoffHz: 100 };
    let state = audioReducer(
      readyAudio(),
      audioTrackFiltersApplied({ streamIndex: 2, filters: [a, b] }),
    );

    state = audioReducer(
      state,
      waveformsLoading({ jobId: "current", streamIndexes: [2], width: 128 }),
    );
    state = audioReducer(
      state,
      waveformReady({
        jobId: "current",
        streamIndex: 2,
        width: 128,
        status: "ready",
        url: "media://processed",
      }),
    );
    expect(
      audioReducer(state, audioTrackVolumeChanged({ streamIndex: 2, volume: 0 })).tracks[0]
        ?.waveform,
    ).toBe(state.tracks[0]?.waveform);
    for (const filters of [
      [b, a],
      [a],
      [a, b, { ...a, id: "extra" }],
      [{ ...a, gainDb: -3 }, b],
      [a, { ...b, cutoffHz: 400 }],
    ]) {
      const changed = audioReducer(state, audioTrackFiltersApplied({ streamIndex: 2, filters }));
      expect(changed.tracks[0]?.waveform).toEqual({ status: "idle" });
      const stale = audioReducer(
        changed,
        waveformReady({
          jobId: "current",
          streamIndex: 2,
          width: 128,
          status: "ready",
          url: "media://stale",
        }),
      );

      expect(stale.tracks[0]?.waveform).toEqual({ status: "idle" });
    }
    expect(audioReducer(state, audioTrackFiltersApplied({ streamIndex: 2, filters: [a, b] }))).toBe(
      state,
    );
  });
});
