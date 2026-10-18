import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ analyzeAudioLoudness: vi.fn() }));

vi.mock("@/lib/tauri/media", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/tauri/media")>();
  return { ...original, analyzeAudioLoudness: mocks.analyzeAudioLoudness };
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

  it("measures the original stream once regardless of consecutive trim edits", async () => {
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
      endMicros: 5_000_000,
      startMicros: 0,
    });
  });
});

describe("draft preview measurement", () => {
  const gain = (id: string, gainDb: number): AudioFilter => ({
    enabled: true,
    gainDb,
    id,
    type: "gain",
  });

  function preview(store: ReturnType<typeof createStore>, filters: AudioFilter[]) {
    store.dispatch(audioFilterPreviewChanged({ filters, id: "preview" }));
  }

  it("measures the latest draft once rapid upstream edits settle", async () => {
    const store = createStore();
    store.dispatch(audioFilterPreviewStarted({ id: "preview", streamIndex: 2 }));
    for (const gainDb of [1, 2, 3, 4]) {
      preview(store, [gain("pre", gainDb), normalization]);
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(mocks.analyzeAudioLoudness).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);

    expect(mocks.analyzeAudioLoudness).toHaveBeenCalledOnce();
    expect(mocks.analyzeAudioLoudness.mock.calls[0]?.[0].audioTrack.filters).toEqual([
      gain("pre", 4),
      normalization,
    ]);
    expect(store.getState().audio.filterPreview?.loudnessAnalysis.status).toBe("ready");
    expect(store.getState().audio.tracks[0]?.loudnessAnalysis).toEqual({ status: "idle" });
  });

  it("reuses measurements for target and downstream edits and the committed measurement", async () => {
    const store = createStore();
    store.dispatch(audioTrackFiltersApplied({ filters: [normalization], streamIndex: 2 }));
    await vi.advanceTimersByTimeAsync(300);
    expect(mocks.analyzeAudioLoudness).toHaveBeenCalledOnce();

    store.dispatch(audioFilterPreviewStarted({ id: "preview", streamIndex: 2 }));
    preview(store, [{ ...normalization, targetLufs: -23 }, gain("post", 6)]);
    await vi.advanceTimersByTimeAsync(300);
    preview(store, [gain("pre", -3), normalization]);
    await vi.advanceTimersByTimeAsync(300);
    expect(mocks.analyzeAudioLoudness).toHaveBeenCalledTimes(2);

    // Returning to the committed inputs adopts the committed measurement again.
    preview(store, [normalization, gain("post", 3)]);
    await vi.advanceTimersByTimeAsync(300);
    expect(mocks.analyzeAudioLoudness).toHaveBeenCalledTimes(2);
    expect(store.getState().audio.filterPreview?.loudnessAnalysis).toMatchObject({
      status: "ready",
    });
  });

  it("stops a superseded draft measurement and measures dependent instances in one request", async () => {
    const store = createStore();
    const signals: AbortSignal[] = [];
    mocks.analyzeAudioLoudness.mockImplementation(
      (_request: unknown, signal: AbortSignal) =>
        new Promise((resolve, reject) => {
          signals.push(signal);
          signal.addEventListener("abort", () => reject(new DOMException("", "AbortError")));
          setTimeout(() => resolve([{ filterId: "norm", integratedLufs: -20 }]), 1_000);
        }),
    );
    store.dispatch(audioFilterPreviewStarted({ id: "preview", streamIndex: 2 }));
    preview(store, [gain("pre", 3), normalization]);
    await vi.advanceTimersByTimeAsync(300);
    expect(signals).toHaveLength(1);

    const second = { ...normalization, id: "second" };
    preview(store, [gain("pre", 6), normalization, gain("between", -2), second]);
    expect(signals[0]?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(300);
    expect(mocks.analyzeAudioLoudness.mock.calls[1]?.[0].audioTrack.filters).toEqual([
      gain("pre", 6),
      normalization,
      gain("between", -2),
      second,
    ]);

    store.dispatch(audioFilterPreviewEnded({ id: "preview" }));
    expect(signals[1]?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(store.getState().audio.filterPreview).toBeNull();
    expect(store.getState().audio.tracks[0]?.loudnessAnalysis).toEqual({ status: "idle" });
  });
});
