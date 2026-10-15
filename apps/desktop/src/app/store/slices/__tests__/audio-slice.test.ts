import { describe, expect, it } from "vitest";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { trimChanged } from "@/app/store/slices/trim-slice";
import { createEditorSnapshot } from "@/domain/editor-snapshot";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

import {
  audioReducer,
  audioTrackActivityAnalysisStarted,
  audioTrackDefaultChanged,
  audioTrackGainChanged,
  audioTrackLoudnessAnalysisReady,
  audioTrackLoudnessAnalysisStarted,
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

    expect(selectAudioTracks({ audio: ready } as never)).toHaveLength(2);
    expect(unmuted.tracks[0]).toMatchObject({ enabled: true, processing: { gainDb: -3.5 } });
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
    expect(current.tracks[0]?.metadata.isDefault).toBe(false);
    expect(current.tracks[0]?.waveform).toMatchObject({ status: "ready", url: "media://current" });
    expect(current.tracks[1]?.metadata.isDefault).toBe(true);
  });

  it("restores one enabled default when an older snapshot disables the source default", () => {
    const snapshot = createEditorSnapshot({
      source: firstSource,
      trim: { kind: "full-source" },
      crop: null,
      audioTracks: [
        { enabled: false, streamIndex: 2, metadata: {}, processing: { gainDb: 0 } },
        {
          enabled: true,
          streamIndex: 4,
          metadata: { language: "ru" },
          processing: { gainDb: 0 },
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

    const processingWithUpstreamEffect = {
      ...normalized.tracks[0]!.processing,
      effects: [{ cutoffHz: 100, stage: "cleanup" as const, type: "highPass" as const }],
    };

    const upstreamChanged = audioReducer(
      normalized,
      audioTrackProcessingChanged({
        streamIndex: 2,
        processing: processingWithUpstreamEffect,
      }),
    );

    expect(upstreamChanged.tracks[0]?.loudnessAnalysis).toEqual({ status: "idle" });

    const trimmed = audioReducer(
      upstreamChanged,
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

  it("keeps a cached source-shape waveform when Limiter changes", () => {
    let state = audioReducer(
      readyAudio(),
      waveformsLoading({ jobId: "waveform-1", streamIndexes: [2], width: 800 }),
    );

    state = audioReducer(
      state,
      waveformReady({
        jobId: "waveform-1",
        streamIndex: 2,
        status: "ready",
        url: "media://waveform",
        width: 800,
      }),
    );

    const changed = audioReducer(
      state,
      audioTrackProcessingChanged({
        streamIndex: 2,
        processing: {
          gainDb: 0,
          effects: [{ ceilingDb: -1, stage: "finalProtection", type: "limiter" }],
        },
      }),
    );

    expect(changed.tracks[0]?.waveform).toMatchObject({ status: "ready", url: "media://waveform" });
  });
});
