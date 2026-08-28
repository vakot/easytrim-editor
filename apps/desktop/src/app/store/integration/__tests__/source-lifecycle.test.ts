import { describe, expect, it } from "vitest";

import { sourceCleared, sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { audioMergeToggled } from "@/app/store/slices/audio-slice";
import { cropChanged } from "@/app/store/slices/crop-slice";
import { previewReady } from "@/app/store/slices/preview-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import { createAppStore } from "@/app/store/store";
import { firstSource, media, secondSource } from "@/test/source.fixtures";

describe("source-bound lifecycle", () => {
  it("atomically resets every source-bound domain through one source event", () => {
    const store = createAppStore();
    store.dispatch(sourceSelected({ source: firstSource, loadToken: 1 }));
    store.dispatch(sourceSelected({ source: secondSource, loadToken: 2 }));
    store.dispatch(sourceReady({ loadToken: 1, media: media(firstSource.sourcePath) }));
    store.dispatch(
      trimChanged({
        trim: {
          startMicros: 1_000_000,
          endMicros: 4_000_000,
          sourceDurationMicros: 5_000_000,
        },
      }),
    );
    store.dispatch(
      cropChanged({
        crop: { x: 0.1, y: 0, width: 0.8, height: 1 },
        resolution: { width: 1536, height: 1080 },
      }),
    );
    store.dispatch(audioMergeToggled());
    store.dispatch(
      previewReady({
        preview: { mediaToken: 1, kind: "source", url: "media://first" },
      }),
    );

    store.dispatch(sourceSelected({ source: secondSource }));
    const state = store.getState();

    expect(state.source.source).toEqual(secondSource);
    expect(state.trim.value).toBeNull();
    expect(state.crop.value).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(state.audio).toMatchObject({ tracks: [], mergeAudio: false });
    expect(state.preview.value).toEqual({ status: "idle" });
  });

  it("clears all source-bound domains through sourceCleared", () => {
    const store = createAppStore();
    store.dispatch(sourceSelected({ source: firstSource, loadToken: 1 }));
    store.dispatch(sourceReady({ loadToken: 1, media: media(firstSource.sourcePath) }));
    store.dispatch(sourceCleared());

    expect(store.getState().source.source).toBeNull();
    expect(store.getState().trim.value).toBeNull();
    expect(store.getState().audio.previews).toBeNull();
    expect(store.getState().preview.value).toEqual({ status: "idle" });
  });

  it("rejects sourceReady metadata from another source across domains", () => {
    const store = createAppStore();
    store.dispatch(sourceSelected({ source: firstSource, loadToken: 1 }));
    store.dispatch(sourceSelected({ source: secondSource, loadToken: 2 }));
    store.dispatch(sourceReady({ loadToken: 1, media: media(secondSource.sourcePath) }));

    const state = store.getState();
    expect(state.source.status).toBe("loading-source");
    expect(state.source.media).toBeNull();
    expect(state.trim.value).toBeNull();
    expect(state.audio.tracks).toEqual([]);
  });
});
