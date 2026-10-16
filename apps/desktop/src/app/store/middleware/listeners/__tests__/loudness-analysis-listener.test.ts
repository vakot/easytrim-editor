import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ analyzeAudioLoudness: vi.fn() }));

vi.mock("@/lib/tauri/media", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/tauri/media")>();
  return { ...original, analyzeAudioLoudness: mocks.analyzeAudioLoudness };
});

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import {
  audioTrackFiltersApplied,
  audioTrackToggled,
  audioTrackVolumeChanged,
} from "@/app/store/slices/audio-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import { createAppStore } from "@/app/store/store";
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

function createStore() {
  const store = createAppStore({
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  });

  store.dispatch(sourceSelected({ source: firstSource }));
  store.dispatch(sourceReady({ loadToken: 1, media: mediaWithAudio(firstSource.sourcePath) }));
  return store;
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.analyzeAudioLoudness.mockReset();
  mocks.analyzeAudioLoudness.mockResolvedValue([{ filterId: "norm", integratedLufs: -20 }]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("automatic loudness measurement", () => {
  it("measures an enabled track once its applied chain needs it", async () => {
    const store = createStore();
    store.dispatch(audioTrackFiltersApplied({ filters: [normalization], streamIndex: 2 }));
    await vi.advanceTimersByTimeAsync(300);

    expect(mocks.analyzeAudioLoudness).toHaveBeenCalledOnce();
    expect(store.getState().audio.tracks[0]?.loudnessAnalysis).toMatchObject({ status: "ready" });

    store.dispatch(audioTrackVolumeChanged({ streamIndex: 2, volume: 2 }));
    await vi.advanceTimersByTimeAsync(300);
    expect(mocks.analyzeAudioLoudness).toHaveBeenCalledOnce();
  });

  it("ignores chains without normalization and waits for disabled tracks to be enabled", async () => {
    const store = createStore();
    store.dispatch(
      audioTrackFiltersApplied({
        filters: [{ enabled: true, cutoffHz: 80, id: "hp", type: "highPass" }],
        streamIndex: 4,
      }),
    );
    store.dispatch(audioTrackToggled({ streamIndex: 2 }));
    store.dispatch(audioTrackFiltersApplied({ filters: [normalization], streamIndex: 2 }));
    await vi.advanceTimersByTimeAsync(300);
    expect(mocks.analyzeAudioLoudness).not.toHaveBeenCalled();

    store.dispatch(audioTrackToggled({ streamIndex: 2 }));
    await vi.advanceTimersByTimeAsync(300);
    expect(mocks.analyzeAudioLoudness).toHaveBeenCalledOnce();
  });

  it("coalesces consecutive trim edits into one measurement", async () => {
    const store = createStore();
    store.dispatch(audioTrackFiltersApplied({ filters: [normalization], streamIndex: 2 }));
    for (const endMicros of [3_000_000, 3_500_000, 4_000_000]) {
      store.dispatch(
        trimChanged({ trim: { endMicros, sourceDurationMicros: 5_000_000, startMicros: 0 } }),
      );
      await vi.advanceTimersByTimeAsync(100);
    }
    await vi.advanceTimersByTimeAsync(300);

    expect(mocks.analyzeAudioLoudness).toHaveBeenCalledOnce();
    expect(mocks.analyzeAudioLoudness.mock.calls[0]?.[0].trim).toEqual({
      endMicros: 4_000_000,
      startMicros: 0,
    });
  });
});
