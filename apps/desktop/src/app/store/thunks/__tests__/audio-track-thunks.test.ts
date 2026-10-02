import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  analyzeAudioLoudness: vi.fn(),
  detectAudioActivity: vi.fn(),
  prepareAudioPreviews: vi.fn(),
}));

vi.mock("@/lib/tauri/media", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/tauri/media")>();
  return {
    ...original,
    analyzeAudioLoudness: mocks.analyzeAudioLoudness,
    detectAudioActivity: mocks.detectAudioActivity,
    prepareAudioPreviews: mocks.prepareAudioPreviews,
  };
});

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import {
  audioTrackGainChanged,
  audioTrackProcessingChanged,
  audioTrackToggled,
} from "@/app/store/slices/audio-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import { createAppStore } from "@/app/store/store";
import {
  analyzeTrackLoudness,
  detectTrackActivity,
  prepareTrackPreview,
} from "@/app/store/thunks/audio-track-thunks";
import {
  audioTrackExternalPreviewStreamIndexes,
  type AudioTrackSelection,
} from "@/domain/audio-processing";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

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
  vi.clearAllMocks();
});

describe("audio track operations", () => {
  it("regenerates a limited preview when committed manual gain changes", async () => {
    const store = createStore();
    store.dispatch(audioTrackToggled({ streamIndex: 4 }));
    mocks.prepareAudioPreviews.mockImplementation(
      async (_sourcePath: string, tracks: AudioTrackSelection[]) =>
        tracks.map((track, index) => ({
          mediaToken: 1,
          previewRevision: index + 1,
          processing: track.processing,
          streamIndex: track.streamIndex,
          url: `media://preview-${track.streamIndex}-${index + 1}`,
        })),
    );
    store.dispatch(
      audioTrackProcessingChanged({
        streamIndex: 2,
        processing: {
          gainDb: 0,
          effects: [{ ceilingDb: -1, stage: "finalProtection", type: "limiter" }],
        },
      }),
    );
    await vi.waitFor(() => expect(mocks.prepareAudioPreviews).toHaveBeenCalledTimes(1));

    store.dispatch(audioTrackGainChanged({ gainDb: 6, streamIndex: 2 }));
    await vi.waitFor(() => expect(mocks.prepareAudioPreviews).toHaveBeenCalledTimes(2));

    expect(mocks.prepareAudioPreviews.mock.calls[1]?.[1][0]?.processing).toMatchObject({
      gainDb: 6,
      effects: [{ ceilingDb: -1, stage: "finalProtection", type: "limiter" }],
    });
  });

  it("bakes committed manual gain before Limiter in the processed playback preview", async () => {
    const store = createStore();
    store.dispatch(audioTrackToggled({ streamIndex: 4 }));
    store.dispatch(
      audioTrackProcessingChanged({
        streamIndex: 2,
        processing: {
          gainDb: 6,
          effects: [{ ceilingDb: -1, stage: "finalProtection", type: "limiter" }],
        },
      }),
    );
    mocks.prepareAudioPreviews.mockImplementation(
      async (_sourcePath: string, tracks: AudioTrackSelection[]) =>
        tracks.map((track) => ({
          mediaToken: 1,
          previewRevision: 1,
          processing: track.processing,
          streamIndex: track.streamIndex,
          url: `media://preview-${track.streamIndex}`,
        })),
    );

    await store.dispatch(prepareTrackPreview(2));

    expect(mocks.prepareAudioPreviews).toHaveBeenCalledWith(firstSource.sourcePath, [
      expect.objectContaining({
        streamIndex: 2,
        processing: {
          gainDb: 6,
          effects: [{ ceilingDb: -1, stage: "finalProtection", type: "limiter" }],
        },
      }),
    ]);
  });

  it("returns a single default track to native playback when normalization is disabled", async () => {
    const store = createStore();
    store.dispatch(audioTrackToggled({ streamIndex: 4 }));
    mocks.analyzeAudioLoudness.mockResolvedValue({ integratedLufs: -18, truePeakDb: -2 });
    mocks.prepareAudioPreviews.mockImplementation(
      async (_sourcePath: string, tracks: AudioTrackSelection[]) =>
        tracks.map((track, index) => ({
          mediaToken: 1,
          previewRevision: index + 1,
          processing: track.processing,
          streamIndex: track.streamIndex,
          url: `media://preview-${track.streamIndex}`,
        })),
    );

    store.dispatch(
      audioTrackProcessingChanged({
        streamIndex: 2,
        processing: { gainDb: 0, loudnessNormalization: "streaming" },
      }),
    );
    await vi.waitFor(() => expect(store.getState().audio.tracks[0]?.preview.status).toBe("ready"));
    expect(audioTrackExternalPreviewStreamIndexes(store.getState().audio.tracks, 2)).toEqual([2]);

    store.dispatch(audioTrackProcessingChanged({ streamIndex: 2, processing: { gainDb: 0 } }));

    expect(audioTrackExternalPreviewStreamIndexes(store.getState().audio.tracks, 2)).toEqual([]);
    expect(store.getState().audio.tracks[0]?.processing).toEqual({ gainDb: 0 });
  });

  it("prepares every enabled track after normalization is removed from a multi-track route", async () => {
    const store = createStore();
    mocks.analyzeAudioLoudness.mockResolvedValue({ integratedLufs: -18, truePeakDb: -2 });
    mocks.prepareAudioPreviews.mockImplementation(
      async (_sourcePath: string, tracks: AudioTrackSelection[]) =>
        tracks.map((track, index) => ({
          mediaToken: 1,
          previewRevision: index + 1,
          processing: track.processing,
          streamIndex: track.streamIndex,
          url: `media://preview-${track.streamIndex}-${index + 1}`,
        })),
    );

    store.dispatch(
      audioTrackProcessingChanged({
        streamIndex: 2,
        processing: { gainDb: 0, loudnessNormalization: "streaming" },
      }),
    );
    await vi.waitFor(() => expect(mocks.prepareAudioPreviews).toHaveBeenCalledTimes(2));

    store.dispatch(audioTrackProcessingChanged({ streamIndex: 2, processing: { gainDb: 0 } }));
    await vi.waitFor(() => expect(mocks.prepareAudioPreviews).toHaveBeenCalledTimes(3));

    expect(audioTrackExternalPreviewStreamIndexes(store.getState().audio.tracks, 2)).toEqual([
      2, 4,
    ]);
    expect(store.getState().audio.tracks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          streamIndex: 2,
          preview: expect.objectContaining({ status: "ready" }),
        }),
        expect.objectContaining({
          streamIndex: 4,
          preview: expect.objectContaining({ status: "ready" }),
        }),
      ]),
    );
  });

  it("analyzes muted tracks with their effective processing settings", async () => {
    const store = createStore();
    store.dispatch(audioTrackToggled({ streamIndex: 2 }));
    mocks.analyzeAudioLoudness.mockResolvedValue({ integratedLufs: -18, truePeakDb: -2 });
    mocks.detectAudioActivity.mockResolvedValue([{ startMicros: 100, endMicros: 200 }]);

    await store.dispatch(analyzeTrackLoudness(2));
    await store.dispatch(detectTrackActivity(2));

    const track = store.getState().audio.tracks[0]!;
    expect(track.enabled).toBe(false);
    expect(track.loudnessAnalysis).toMatchObject({
      status: "ready",
      value: { integratedLufs: -18 },
    });
    expect(track.activityAnalysis).toMatchObject({
      status: "ready",
      value: [{ startMicros: 100 }],
    });
    expect(mocks.analyzeAudioLoudness).toHaveBeenCalledWith(
      expect.objectContaining({
        audioTrack: { streamIndex: 2, processing: { gainDb: 0 } },
      }),
    );
    expect(mocks.detectAudioActivity).toHaveBeenCalledWith(
      firstSource.sourcePath,
      { streamIndex: 2, processing: { gainDb: 0 } },
      expect.any(Number),
    );
  });

  it("keeps a source preview reusable across committed gain changes", async () => {
    const store = createStore();
    let finishPreview!: (value: unknown) => void;
    mocks.prepareAudioPreviews.mockReturnValue(
      new Promise((resolve) => {
        finishPreview = resolve;
      }),
    );

    const pendingPreview = store.dispatch(prepareTrackPreview(2));
    store.dispatch(audioTrackGainChanged({ streamIndex: 2, gainDb: 3 }));
    finishPreview([
      {
        mediaToken: 1,
        previewRevision: 4,
        processing: { gainDb: 0 },
        streamIndex: 2,
        url: "easytrim-media://localhost/1?variant=audio&stream=2&revision=4",
      },
    ]);
    await pendingPreview;

    expect(store.getState().audio.tracks[0]?.preview).toMatchObject({ status: "ready" });
  });

  it("does not let an older preview job replace newer committed processing", async () => {
    const store = createStore();
    let finishOldPreview!: (value: unknown) => void;
    mocks.prepareAudioPreviews
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishOldPreview = resolve;
        }),
      )
      .mockResolvedValue([
        {
          mediaToken: 1,
          previewRevision: 9,
          processing: { gainDb: 0, loudnessNormalization: "streaming" },
          streamIndex: 2,
          url: "media://new-processing",
        },
      ]);
    mocks.analyzeAudioLoudness.mockResolvedValue({ integratedLufs: -18, truePeakDb: -2 });

    const oldPreview = store.dispatch(prepareTrackPreview(2));
    await vi.waitFor(() => expect(mocks.prepareAudioPreviews).toHaveBeenCalledTimes(1));
    store.dispatch(
      audioTrackProcessingChanged({
        streamIndex: 2,
        processing: { gainDb: 0, loudnessNormalization: "streaming" },
      }),
    );
    await vi.waitFor(() => {
      expect(store.getState().audio.tracks[0]?.preview).toMatchObject({
        descriptor: { url: "media://new-processing" },
        status: "ready",
      });
    });

    finishOldPreview([
      {
        mediaToken: 1,
        previewRevision: 8,
        processing: { gainDb: 0 },
        streamIndex: 2,
        url: "media://old-processing",
      },
    ]);
    await oldPreview;

    expect(store.getState().audio.tracks[0]?.preview).toMatchObject({
      descriptor: { url: "media://new-processing" },
      status: "ready",
    });
  });

  it("refreshes normalized playback preview from the newly committed trim measurement", async () => {
    const store = createStore();
    store.dispatch(
      audioTrackProcessingChanged({
        streamIndex: 2,
        processing: { gainDb: 0, loudnessNormalization: "streaming" },
      }),
    );
    store.dispatch(
      trimChanged({
        trim: { startMicros: 500_000, endMicros: 3_000_000, sourceDurationMicros: 5_000_000 },
      }),
    );
    mocks.analyzeAudioLoudness.mockResolvedValue({ integratedLufs: -20, truePeakDb: -4 });
    mocks.prepareAudioPreviews.mockResolvedValue([
      {
        mediaToken: 1,
        previewRevision: 8,
        processing: { gainDb: 0, loudnessNormalization: "streaming" },
        streamIndex: 2,
        url: "easytrim-media://localhost/1?variant=audio&stream=2&revision=8",
      },
    ]);

    await vi.waitFor(() => {
      expect(mocks.analyzeAudioLoudness).toHaveBeenCalledWith({
        audioTrack: {
          processing: { gainDb: 0, loudnessNormalization: "streaming" },
          streamIndex: 2,
        },
        sourcePath: firstSource.sourcePath,
        trim: { startMicros: 500_000, endMicros: 3_000_000 },
      });
      expect(mocks.prepareAudioPreviews).toHaveBeenCalledWith(firstSource.sourcePath, [
        {
          loudnessAnalysis: { integratedLufs: -20, truePeakDb: -4 },
          processing: { gainDb: 0, loudnessNormalization: "streaming" },
          streamIndex: 2,
        },
      ]);
      expect(store.getState().audio.tracks[0]?.preview).toMatchObject({
        descriptor: { previewRevision: 8 },
        status: "ready",
      });
    });
  });

  it("analyzes clean source audio and keeps the result across level policy edits", async () => {
    const store = createStore();
    let finishAnalysis!: (value: { integratedLufs: number; truePeakDb: number }) => void;
    mocks.analyzeAudioLoudness.mockReturnValue(
      new Promise((resolve) => {
        finishAnalysis = resolve;
      }),
    );

    const pendingAnalysis = store.dispatch(analyzeTrackLoudness(2));
    store.dispatch(audioTrackGainChanged({ streamIndex: 2, gainDb: -5 }));
    store.dispatch(
      audioTrackProcessingChanged({
        streamIndex: 2,
        processing: { gainDb: -5, loudnessNormalization: "streaming" },
      }),
    );
    finishAnalysis({ integratedLufs: -18, truePeakDb: -2 });
    await pendingAnalysis;

    expect(mocks.analyzeAudioLoudness).toHaveBeenCalledWith(
      expect.objectContaining({ audioTrack: { streamIndex: 2, processing: { gainDb: 0 } } }),
    );
    expect(store.getState().audio.tracks[0]?.loudnessAnalysis).toMatchObject({
      status: "ready",
      value: { integratedLufs: -18 },
    });
  });

  it("analyzes the Effects draft pre-level signal without applying the draft", async () => {
    const store = createStore();
    const draftProcessing = {
      gainDb: 7,
      loudnessNormalization: "streaming" as const,
      effects: [{ type: "highPass" as const, stage: "cleanup" as const, cutoffHz: 100 }],
    };

    mocks.analyzeAudioLoudness.mockResolvedValue({ integratedLufs: -18, truePeakDb: -2 });

    await store.dispatch(analyzeTrackLoudness(2, draftProcessing));

    expect(mocks.analyzeAudioLoudness).toHaveBeenCalledWith(
      expect.objectContaining({
        audioTrack: { streamIndex: 2, processing: draftProcessing },
      }),
    );
    expect(store.getState().audio.tracks[0]?.processing).toEqual({ gainDb: 0 });
  });
});
