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
import { audioTrackGainChanged, audioTrackToggled } from "@/app/store/slices/audio-slice";
import { createAppStore } from "@/app/store/store";
import {
  analyzeTrackLoudness,
  detectTrackActivity,
  prepareTrackPreview,
} from "@/app/store/thunks/audio-track-thunks";
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
});
