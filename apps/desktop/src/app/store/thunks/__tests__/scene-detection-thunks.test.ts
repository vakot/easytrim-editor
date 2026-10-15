import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  detectScenes: vi.fn(),
}));

vi.mock("@/lib/tauri/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tauri/media")>()),
  detectScenes: mocks.detectScenes,
}));

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import {
  activeEditingInstanceChanged,
  editingInstancesAdded,
  selectActiveSceneBoundariesMicros,
} from "@/app/store/slices/editing-instances-slice";
import {
  sceneMarkersToggled,
  selectSceneDetectionStatus,
  selectVisibleSceneBoundariesMicros,
} from "@/app/store/slices/scene-detection-slice";
import { createAppStore } from "@/app/store/store";
import { detectActiveSourceScenes } from "@/app/store/thunks/scene-detection-thunks";
import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { firstSource, media } from "@/test/source.fixtures";

function createStore() {
  const store = createAppStore({
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  });

  store.dispatch(
    editingInstancesAdded([
      {
        exportAttempts: [],
        id: "first",
        origin: "source-import",
        snapshot: createDefaultEditorSnapshot(firstSource),
        sourceAvailability: "available",
      },
    ]),
  );
  store.dispatch(activeEditingInstanceChanged("first"));
  store.dispatch(sourceSelected({ loadToken: 1, source: firstSource }));
  store.dispatch(sourceReady({ loadToken: 1, media: media(firstSource.sourcePath) }));
  return store;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("scene detection", () => {
  it("stores detected boundaries on the active editing instance", async () => {
    const store = createStore();
    const result = deferred<number[]>();
    mocks.detectScenes.mockReturnValueOnce(result.promise);

    expect(selectSceneDetectionStatus(store.getState())).toEqual({ status: "idle" });
    const detection = store.dispatch(detectActiveSourceScenes());
    expect(selectSceneDetectionStatus(store.getState())).toEqual({ status: "loading" });

    result.resolve([1_000_000, 2_500_000]);
    await detection;

    expect(mocks.detectScenes).toHaveBeenCalledWith(firstSource.sourcePath);
    expect(selectSceneDetectionStatus(store.getState())).toEqual({ status: "ready" });
    expect(selectActiveSceneBoundariesMicros(store.getState())).toEqual([1_000_000, 2_500_000]);
  });

  it("does not start a second detection while one is running", async () => {
    const store = createStore();
    const result = deferred<number[]>();
    mocks.detectScenes.mockReturnValueOnce(result.promise);

    const detection = store.dispatch(detectActiveSourceScenes());
    await store.dispatch(detectActiveSourceScenes());
    result.resolve([]);
    await detection;

    expect(mocks.detectScenes).toHaveBeenCalledTimes(1);
  });

  it("reports a failure and allows retrying", async () => {
    const store = createStore();
    const error = {
      code: "scene_detection_failed",
      message: "media.scene.sceneDetectionTookTooLong",
    };
    mocks.detectScenes.mockRejectedValueOnce(error).mockResolvedValueOnce([3_000_000]);

    await store.dispatch(detectActiveSourceScenes());
    expect(selectSceneDetectionStatus(store.getState())).toMatchObject({
      error: { code: "scene_detection_failed" },
      status: "failed",
    });

    await store.dispatch(detectActiveSourceScenes());
    expect(selectSceneDetectionStatus(store.getState())).toEqual({ status: "ready" });
    expect(selectActiveSceneBoundariesMicros(store.getState())).toEqual([3_000_000]);
  });

  it("ignores a result that arrives after the source was reloaded", async () => {
    const store = createStore();
    const result = deferred<number[]>();
    mocks.detectScenes.mockReturnValueOnce(result.promise);

    const detection = store.dispatch(detectActiveSourceScenes());
    store.dispatch(sourceSelected({ loadToken: 2, source: firstSource }));
    store.dispatch(sourceReady({ loadToken: 2, media: media(firstSource.sourcePath) }));
    result.resolve([1_000_000]);
    await detection;

    expect(selectSceneDetectionStatus(store.getState())).toEqual({ status: "idle" });
    expect(selectActiveSceneBoundariesMicros(store.getState())).toEqual([]);
  });

  it("hides detected boundaries without discarding them", async () => {
    const store = createStore();
    mocks.detectScenes.mockResolvedValueOnce([1_000_000]);
    await store.dispatch(detectActiveSourceScenes());

    store.dispatch(sceneMarkersToggled());
    expect(selectVisibleSceneBoundariesMicros(store.getState())).toEqual([]);
    expect(selectSceneDetectionStatus(store.getState())).toEqual({ status: "ready" });

    store.dispatch(sceneMarkersToggled());
    expect(selectVisibleSceneBoundariesMicros(store.getState())).toEqual([1_000_000]);
  });
});
