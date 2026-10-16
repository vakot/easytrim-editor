import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  analyzeAudioLoudness: vi.fn(),
  detectAudioActivity: vi.fn(),
}));

vi.mock("@/lib/tauri/media", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/tauri/media")>();
  return {
    ...original,
    analyzeAudioLoudness: mocks.analyzeAudioLoudness,
    detectAudioActivity: mocks.detectAudioActivity,
  };
});

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import {
  audioFilterPreviewChanged,
  audioFilterPreviewEnded,
  audioFilterPreviewStarted,
  audioTrackFiltersApplied,
  audioTrackToggled,
  audioTrackVolumeChanged,
} from "@/app/store/slices/audio-slice";
import { createAppStore } from "@/app/store/store";
import {
  analyzeFilterPreviewLoudness,
  analyzeTrackLoudness,
  detectTrackActivity,
  releaseUnawaitedPreviewLoudnessAnalyses,
} from "@/app/store/thunks/audio-track-thunks";
import type { AudioFilter } from "@/domain/audio-processing";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

const normalization: AudioFilter = {
  enabled: true,
  id: "norm",
  loudnessRangeLu: 11,
  maxTruePeakDb: -1.5,
  targetLufs: -16,
  type: "loudnessNormalization",
};

const highPass: AudioFilter = { enabled: true, cutoffHz: 100, id: "hp", type: "highPass" };
const measurement = { filterId: "norm", integratedLufs: -18, truePeakDb: -2 };

function createStore(filters: AudioFilter[] = [normalization]) {
  const store = createAppStore({
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  });

  store.dispatch(sourceSelected({ source: firstSource }));
  store.dispatch(sourceReady({ loadToken: 1, media: mediaWithAudio(firstSource.sourcePath) }));
  store.dispatch(audioTrackFiltersApplied({ filters, streamIndex: 2 }));
  return store;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("audio track operations", () => {
  it("analyzes and detects activity on muted tracks with their measured chain", async () => {
    const store = createStore();
    store.dispatch(audioTrackToggled({ streamIndex: 2 }));
    mocks.analyzeAudioLoudness.mockResolvedValue([measurement]);
    mocks.detectAudioActivity.mockResolvedValue([{ startMicros: 100, endMicros: 200 }]);

    await store.dispatch(detectTrackActivity(2));

    const track = store.getState().audio.tracks[0]!;
    expect(track.enabled).toBe(false);
    expect(track.loudnessAnalysis).toMatchObject({ status: "ready", value: [measurement] });
    expect(track.activityAnalysis).toMatchObject({
      status: "ready",
      value: [{ startMicros: 100 }],
    });
    expect(mocks.analyzeAudioLoudness).toHaveBeenCalledWith(
      expect.objectContaining({ audioTrack: { filters: [normalization], streamIndex: 2 } }),
    );
    expect(mocks.detectAudioActivity).toHaveBeenCalledWith(
      firstSource.sourcePath,
      { filters: [normalization], loudnessMeasurements: [measurement], streamIndex: 2 },
      expect.any(Number),
    );
  });

  it("does not analyze a chain without loudness normalization", async () => {
    const store = createStore([highPass]);
    mocks.detectAudioActivity.mockResolvedValue([]);

    await store.dispatch(analyzeTrackLoudness(2));
    await store.dispatch(detectTrackActivity(2));

    expect(mocks.analyzeAudioLoudness).not.toHaveBeenCalled();
    expect(mocks.detectAudioActivity).toHaveBeenCalledWith(
      firstSource.sourcePath,
      { filters: [highPass], streamIndex: 2 },
      expect.any(Number),
    );
  });

  it("keeps measurements when Track Volume or downstream filters change mid-analysis", async () => {
    const store = createStore();
    let finishAnalysis!: (value: unknown) => void;
    mocks.analyzeAudioLoudness.mockReturnValue(
      new Promise((resolve) => {
        finishAnalysis = resolve;
      }),
    );

    const pendingAnalysis = store.dispatch(analyzeTrackLoudness(2));
    store.dispatch(audioTrackVolumeChanged({ streamIndex: 2, volume: 0.5 }));
    store.dispatch(
      audioTrackFiltersApplied({
        filters: [normalization, { enabled: true, gainDb: -3, id: "post", type: "gain" }],
        streamIndex: 2,
      }),
    );
    finishAnalysis([measurement]);
    await pendingAnalysis;

    expect(store.getState().audio.tracks[0]?.loudnessAnalysis).toMatchObject({
      status: "ready",
      value: [measurement],
    });
  });

  it("drops a stale measurement after an upstream filter changes", async () => {
    const store = createStore();
    let finishAnalysis!: (value: unknown) => void;
    mocks.analyzeAudioLoudness.mockReturnValue(
      new Promise((resolve) => {
        finishAnalysis = resolve;
      }),
    );

    const pendingAnalysis = store.dispatch(analyzeTrackLoudness(2));
    store.dispatch(
      audioTrackFiltersApplied({ filters: [highPass, normalization], streamIndex: 2 }),
    );
    finishAnalysis([measurement]);
    await pendingAnalysis;

    expect(store.getState().audio.tracks[0]?.loudnessAnalysis).toEqual({ status: "idle" });
  });

  it("measures a previewed draft without changing the committed chain", async () => {
    const store = createStore([]);
    const draft = [highPass, normalization];
    mocks.analyzeAudioLoudness.mockResolvedValue([measurement]);
    store.dispatch(audioFilterPreviewStarted({ id: "preview", streamIndex: 2 }));
    store.dispatch(audioFilterPreviewChanged({ filters: draft, id: "preview" }));

    await store.dispatch(analyzeFilterPreviewLoudness());

    expect(mocks.analyzeAudioLoudness).toHaveBeenCalledWith(
      expect.objectContaining({ audioTrack: { filters: draft, streamIndex: 2 } }),
      expect.any(AbortSignal),
    );
    expect(store.getState().audio.filterPreview?.loudnessAnalysis).toMatchObject({
      status: "ready",
      value: [measurement],
    });
    const track = store.getState().audio.tracks[0]!;
    expect(track.processing).toEqual({ filters: [], volume: 1 });
    expect(track.loudnessAnalysis).toEqual({ status: "idle" });
  });

  it("keeps a draft measurement that Apply committed, and the committed analysis waits for it", async () => {
    const store = createStore([]);
    let finishAnalysis!: (value: unknown) => void;
    mocks.analyzeAudioLoudness.mockReturnValue(
      new Promise((resolve) => {
        finishAnalysis = resolve;
      }),
    );
    store.dispatch(audioFilterPreviewStarted({ id: "preview", streamIndex: 2 }));
    store.dispatch(audioFilterPreviewChanged({ filters: [normalization], id: "preview" }));
    const measuring = store.dispatch(analyzeFilterPreviewLoudness());

    store.dispatch(audioTrackFiltersApplied({ filters: [normalization], streamIndex: 2 }));
    expect(store.getState().audio.filterPreview).toBeNull();
    releaseUnawaitedPreviewLoudnessAnalyses(store.getState());
    const committedAnalysis = store.dispatch(analyzeTrackLoudness(2));
    finishAnalysis([measurement]);
    await Promise.all([measuring, committedAnalysis]);

    expect(mocks.analyzeAudioLoudness).toHaveBeenCalledOnce();
    expect(mocks.analyzeAudioLoudness.mock.calls[0]?.[1]?.aborted).toBe(false);
    expect(store.getState().audio.tracks[0]?.loudnessAnalysis).toMatchObject({
      status: "ready",
      value: [measurement],
    });
  });

  it("stops a draft measurement once nothing waits for it", async () => {
    const store = createStore([]);
    mocks.analyzeAudioLoudness.mockImplementation(
      (_request: unknown, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("", "AbortError")));
        }),
    );
    store.dispatch(audioFilterPreviewStarted({ id: "preview", streamIndex: 2 }));
    store.dispatch(audioFilterPreviewChanged({ filters: [normalization], id: "preview" }));
    const measuring = store.dispatch(analyzeFilterPreviewLoudness());

    store.dispatch(audioFilterPreviewEnded({ id: "preview" }));
    releaseUnawaitedPreviewLoudnessAnalyses(store.getState());
    await measuring;

    const signal = mocks.analyzeAudioLoudness.mock.calls[0]?.[1] as AbortSignal;
    expect(signal.aborted).toBe(true);
    expect(store.getState().audio.tracks[0]?.loudnessAnalysis).toEqual({ status: "idle" });
  });
});
