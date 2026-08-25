import { describe, expect, it } from "vitest";

import { sourceCleared, sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { createAppStore } from "@/app/store/store";
import { audioMergeChanged } from "@/app/store/slices/audio-slice";
import { cropChanged } from "@/app/store/slices/crop-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import { previewReady } from "@/app/store/slices/preview-slice";
import { firstSource, media, secondSource } from "@/app/store/slices/__tests__/test-fixtures";

describe("source-bound lifecycle", () => {
  it("atomically resets every source-bound domain through one source event", () => {
    const store = createAppStore();
    store.dispatch(sourceSelected({ source: firstSource }));
    store.dispatch(
      sourceReady({ sourceId: firstSource.sourceId, media: media(firstSource.sourceId) }),
    );
    store.dispatch(
      trimChanged({
        sourceId: firstSource.sourceId,
        trim: {
          startMicros: 1_000_000,
          endMicros: 4_000_000,
          sourceDurationMicros: 5_000_000,
        },
      }),
    );
    store.dispatch(
      cropChanged({
        sourceId: firstSource.sourceId,
        crop: { x: 0.1, y: 0, width: 0.8, height: 1 },
      }),
    );
    store.dispatch(audioMergeChanged({ sourceId: firstSource.sourceId, enabled: true }));
    store.dispatch(
      previewReady({
        sourceId: firstSource.sourceId,
        preview: { sourceId: firstSource.sourceId, kind: "source", url: "media://first" },
      }),
    );

    store.dispatch(sourceSelected({ source: secondSource }));
    const state = store.getState();

    expect(state.source.selection).toEqual(secondSource);
    expect(state.trim.value).toBeNull();
    expect(state.crop.value).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(state.audio).toMatchObject({ tracks: [], mergeAudio: false });
    expect(state.preview.value).toEqual({ status: "idle" });
    expect(state.preview.sourceId).toBe(secondSource.sourceId);
  });

  it("clears all source-bound domains through sourceCleared", () => {
    const store = createAppStore();
    store.dispatch(sourceSelected({ source: firstSource }));
    store.dispatch(
      sourceReady({ sourceId: firstSource.sourceId, media: media(firstSource.sourceId) }),
    );
    store.dispatch(sourceCleared());

    expect(store.getState().source.selection).toBeNull();
    expect(store.getState().trim.value).toBeNull();
    expect(store.getState().audio.previews).toBeNull();
    expect(store.getState().preview.value).toEqual({ status: "idle" });
  });
});
