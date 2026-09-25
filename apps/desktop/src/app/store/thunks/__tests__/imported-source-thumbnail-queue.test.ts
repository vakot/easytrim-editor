import { beforeEach, describe, expect, it, vi } from "vitest";

const prepareThumbnail = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tauri/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tauri/media")>()),
  prepareImportedSourceThumbnail: prepareThumbnail,
}));

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  editingInstanceClosed,
  editingInstancesAdded,
} from "@/app/store/slices/editing-instances-slice";
import {
  importedThumbnailReady,
  selectImportedSourceThumbnails,
} from "@/app/store/slices/preview-slice";
import { createAppStore } from "@/app/store/store";
import { prepareImportedSourceThumbnailsRequested } from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance } from "@/domain/editing-instance";
import { firstSource, media } from "@/test/source.fixtures";

const thumbnail = { mediaToken: 1, url: "media://thumbnail" };

function createInstances(count: number, includeMetadata = false): EditingInstance[] {
  return Array.from({ length: count }, (_, index): EditingInstance => {
    const source = {
      ...firstSource,
      displayName: `source-${index}.mp4`,
      sourcePath: `C:/Media/source-${index}.mp4`,
    };

    return {
      exportAttempts: [],
      id: `instance-${index}`,
      ...(includeMetadata ? { media: media(source.sourcePath) } : {}),
      origin: "source-import",
      snapshot: createDefaultEditorSnapshot(source, false),
      sourceAvailability: "available",
    };
  });
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

describe("imported source thumbnail queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepareThumbnail.mockResolvedValue(thumbnail);
  });

  it("keeps rapid enqueue batches and duplicate requests within two global workers", async () => {
    const instances = createInstances(5);
    const store = createAppStore();
    store.dispatch(editingInstancesAdded(instances));
    const pending: Array<ReturnType<typeof createDeferred<typeof thumbnail>>> = [];
    let active = 0;
    let maximumActive = 0;
    prepareThumbnail.mockImplementation(() => {
      const request = createDeferred<typeof thumbnail>();
      pending.push(request);
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      return request.promise.finally(() => {
        active -= 1;
      });
    });

    store.dispatch(prepareImportedSourceThumbnailsRequested(instances.slice(0, 4)));
    store.dispatch(prepareImportedSourceThumbnailsRequested(instances.slice(1)));
    store.dispatch(prepareImportedSourceThumbnailsRequested(instances));

    expect(prepareThumbnail).toHaveBeenCalledTimes(2);
    expect(maximumActive).toBe(2);

    for (let completed = 0; completed < instances.length; completed += 1) {
      pending.shift()?.resolve(thumbnail);
      await vi.waitFor(() =>
        expect(prepareThumbnail).toHaveBeenCalledTimes(Math.min(completed + 3, instances.length)),
      );
    }
    await vi.waitFor(() =>
      expect(Object.keys(selectImportedSourceThumbnails(store.getState()))).toHaveLength(
        instances.length,
      ),
    );
    expect(maximumActive).toBe(2);
  });

  it("discards a queued request when its source has been closed", async () => {
    const instances = createInstances(3);
    const store = createAppStore();
    store.dispatch(editingInstancesAdded(instances));
    const first = createDeferred<typeof thumbnail>();
    const second = createDeferred<typeof thumbnail>();
    prepareThumbnail.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    store.dispatch(prepareImportedSourceThumbnailsRequested(instances));
    store.dispatch(editingInstanceClosed(instances[2]!.id));
    first.resolve(thumbnail);
    await vi.waitFor(() => expect(prepareThumbnail).toHaveBeenCalledTimes(2));
    second.resolve(thumbnail);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(prepareThumbnail).not.toHaveBeenCalledWith(instances[2]!.snapshot.source.sourcePath);
  });

  it("does no work when an app thumbnail is already available", () => {
    const [instance] = createInstances(1, true);
    if (!instance) throw new Error("Expected source fixture");
    const store = createAppStore();
    store.dispatch(editingInstancesAdded([instance]));
    store.dispatch(importedThumbnailReady({ instanceId: instance.id, thumbnail }));

    store.dispatch(prepareImportedSourceThumbnailsRequested([instance]));

    expect(prepareThumbnail).not.toHaveBeenCalled();
  });

  it("passes available stream metadata to native thumbnail generation", async () => {
    const [instance] = createInstances(1, true);
    if (!instance) throw new Error("Expected source fixture");
    const store = createAppStore();
    store.dispatch(editingInstancesAdded([instance]));

    store.dispatch(prepareImportedSourceThumbnailsRequested([instance]));

    expect(prepareThumbnail).toHaveBeenCalledWith(
      instance.snapshot.source.sourcePath,
      instance.media?.video.streamIndex,
    );
    await vi.waitFor(() =>
      expect(selectImportedSourceThumbnails(store.getState())[instance.id]?.status).toBe("ready"),
    );
  });
});
