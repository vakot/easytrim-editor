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
  audioTrackFiltersApplied,
  audioTrackToggled,
  audioTrackVolumeChanged,
} from "@/app/store/slices/audio-slice";
import { createAppStore } from "@/app/store/store";
import { analyzeTrackLoudness, detectTrackActivity } from "@/app/store/thunks/audio-track-thunks";
import type { AudioFilter } from "@/domain/audio-processing";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

const normalization: AudioFilter = {
  id: "norm",
  loudnessRangeLu: 11,
  maxTruePeakDb: -1.5,
  targetLufs: -16,
  type: "loudnessNormalization",
};

const highPass: AudioFilter = { cutoffHz: 100, id: "hp", type: "highPass" };
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
        filters: [normalization, { gainDb: -3, id: "post", type: "gain" }],
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

  it("analyzes a draft chain without applying the draft", async () => {
    const store = createStore([]);
    const draft = [highPass, normalization];
    mocks.analyzeAudioLoudness.mockResolvedValue([measurement]);

    await store.dispatch(analyzeTrackLoudness(2, draft));

    expect(mocks.analyzeAudioLoudness).toHaveBeenCalledWith(
      expect.objectContaining({ audioTrack: { filters: draft, streamIndex: 2 } }),
    );
    expect(store.getState().audio.tracks[0]?.processing).toEqual({ filters: [], volume: 1 });
  });
});
