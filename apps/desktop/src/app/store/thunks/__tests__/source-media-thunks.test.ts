import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  activateSourcePath: vi.fn(),
  analyzeAudioLoudness: vi.fn(),
  prepareWaveforms: vi.fn(),
  inspectMedia: vi.fn(),
  prepareImportedSourceThumbnail: vi.fn(),
  prepareSourcePreview: vi.fn(),
}));

vi.mock("@/lib/tauri/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tauri/media")>()),
  ...native,
}));

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { audioTrackFiltersApplied, audioTrackToggled } from "@/app/store/slices/audio-slice";
import {
  selectActiveEditingInstance,
  selectImportedEditingInstances,
} from "@/app/store/slices/editing-instances-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import { createAppStore } from "@/app/store/store";
import { ingestSources, prepareSourceWaveforms } from "@/app/store/thunks/source-media-thunks";
import type { AudioFilter } from "@/domain/audio-processing";
import { firstSource, media, mediaWithAudio, secondSource } from "@/test/source.fixtures";

beforeEach(() => {
  vi.clearAllMocks();
  native.activateSourcePath.mockImplementation(async (sourcePath: string) => ({
    displayName: sourcePath.split("/").at(-1) ?? sourcePath,
    sourcePath,
  }));
  native.inspectMedia.mockResolvedValue(media(firstSource.sourcePath));
  native.prepareSourcePreview.mockResolvedValue({
    kind: "source",
    mediaToken: 1,
    url: "media://source",
  });
});

describe("source import workflow", () => {
  it("does not inspect media when imported sources are added", () => {
    const store = createAppStore();

    store.dispatch(ingestSources([firstSource, secondSource]));

    expect(native.inspectMedia).not.toHaveBeenCalled();
  });

  it("activates the first source from every newly imported batch", () => {
    const store = createAppStore();

    store.dispatch(ingestSources([firstSource]));
    expect(selectActiveEditingInstance(store.getState())?.snapshot).toEqual(
      createDefaultEditorSnapshot(firstSource),
    );

    store.dispatch(ingestSources([secondSource]));
    expect(selectActiveEditingInstance(store.getState())?.snapshot).toEqual(
      createDefaultEditorSnapshot(secondSource),
    );
  });

  it("stamps all sources in one import batch with the same import time", () => {
    const store = createAppStore();

    store.dispatch(ingestSources([firstSource, secondSource]));

    const importedAtMicros = selectImportedEditingInstances(store.getState()).map(
      ({ importedAtMicros }) => importedAtMicros,
    );

    expect(importedAtMicros[0]).toBeDefined();
    expect(importedAtMicros[0]).toBe(importedAtMicros[1]);
  });
});

const normalizedChain: AudioFilter[] = [
  { id: "gain", type: "gain", gainDb: 6 },
  {
    id: "norm",
    type: "loudnessNormalization",
    targetLufs: -16,
    maxTruePeakDb: -1.5,
    loudnessRangeLu: 11,
  },
  { id: "late", type: "highPass", cutoffHz: 200 },
];

const measurement = { filterId: "norm", integratedLufs: -20, truePeakDb: -4 };

function waveformStore() {
  const store = createAppStore();
  store.dispatch(sourceSelected({ source: firstSource }));
  store.dispatch(sourceReady({ loadToken: 1, media: mediaWithAudio(firstSource.sourcePath) }));
  store.dispatch(audioTrackFiltersApplied({ streamIndex: 2, filters: normalizedChain }));
  native.prepareWaveforms.mockResolvedValue([]);
  return store;
}

describe("processed waveform preparation", () => {
  it("waits for measurements and sends the full pre-volume chain for a disabled track", async () => {
    const store = waveformStore();
    store.dispatch(audioTrackToggled({ streamIndex: 2 }));
    let resolve!: (value: unknown) => void;
    native.analyzeAudioLoudness.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const pending = store.dispatch(prepareSourceWaveforms(firstSource.sourcePath, [2], 128));
    expect(native.prepareWaveforms).not.toHaveBeenCalled();
    resolve([measurement]);
    await pending;
    expect(native.prepareWaveforms).toHaveBeenCalledWith(
      firstSource.sourcePath,
      expect.any(String),
      [2],
      128,
      { 2: normalizedChain },
      { 2: [measurement] },
    );
  });

  it.each(["filters", "trim", "source"])(
    "rejects pending waveform work after %s changes",
    async (change) => {
      const store = waveformStore();
      let resolve!: (value: unknown) => void;
      native.analyzeAudioLoudness.mockReturnValue(
        new Promise((done) => {
          resolve = done;
        }),
      );
      const pending = store.dispatch(prepareSourceWaveforms(firstSource.sourcePath, [2], 128));
      if (change === "filters")
        store.dispatch(audioTrackFiltersApplied({ streamIndex: 2, filters: [] }));
      if (change === "trim")
        store.dispatch(
          trimChanged({ trim: { ...store.getState().trim.value!, startMicros: 100_000 } }),
        );
      if (change === "source") store.dispatch(sourceSelected({ source: secondSource }));
      resolve([measurement]);
      await pending;
      expect(native.prepareWaveforms).not.toHaveBeenCalled();
    },
  );

  it("lets only the newest job submit pending streams after shared analysis completes", async () => {
    const store = waveformStore();
    let resolve!: (value: unknown) => void;
    native.analyzeAudioLoudness.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const older = store.dispatch(prepareSourceWaveforms(firstSource.sourcePath, [2], 128));
    const newer = store.dispatch(prepareSourceWaveforms(firstSource.sourcePath, [4], 128));
    resolve([measurement]);
    await Promise.all([older, newer]);
    expect(native.analyzeAudioLoudness).toHaveBeenCalledOnce();
    expect(native.prepareWaveforms).toHaveBeenCalledOnce();
    expect(native.prepareWaveforms).toHaveBeenCalledWith(
      firstSource.sourcePath,
      expect.any(String),
      [2, 4],
      128,
      { 2: normalizedChain, 4: [] },
      { 2: [measurement], 4: [] },
    );
  });

  it("reports analysis failure without rendering an unresolved normalization chain", async () => {
    const store = waveformStore();
    native.analyzeAudioLoudness.mockRejectedValue({
      code: "render_failed",
      messageId: "media.loudness.ffmpegCouldNotAnalyzeAudioLoudness",
    });
    await store.dispatch(prepareSourceWaveforms(firstSource.sourcePath, [2], 128));
    expect(native.prepareWaveforms).not.toHaveBeenCalled();
    expect(store.getState().audio.tracks[0]?.waveform.status).toBe("failed");
  });
});
