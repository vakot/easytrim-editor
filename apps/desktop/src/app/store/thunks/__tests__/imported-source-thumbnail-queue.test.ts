import { beforeEach, describe, expect, it, vi } from "vitest";

const prepareThumbnail = vi.hoisted(() => vi.fn());
const releaseThumbnail = vi.hoisted(() => vi.fn());
const activateSource = vi.hoisted(() => vi.fn());
const inspectActiveSource = vi.hoisted(() => vi.fn());
const prepareActivePreview = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tauri/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tauri/media")>()),
  activateSourcePath: activateSource,
  inspectMedia: inspectActiveSource,
  prepareSourcePreview: prepareActivePreview,
  prepareImportedSourceThumbnail: prepareThumbnail,
  releaseImportedSourceThumbnail: releaseThumbnail,
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
import {
  activateEditingInstanceRequested,
  IMPORTED_THUMBNAIL_POOL_LIMIT,
  prepareImportedSourceThumbnailsRequested,
  releaseImportedSourceThumbnailDemand,
} from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance } from "@/domain/editing-instance";
import { firstSource, media } from "@/test/source.fixtures";

const thumbnail = { mediaToken: 1, url: "media://thumbnail" };

function createInstances(count: number): EditingInstance[] {
  return Array.from({ length: count }, (_, index): EditingInstance => {
    const source = {
      ...firstSource,
      displayName: `source-${index}.mp4`,
      sourcePath: `C:/Media/source-${index}.mp4`,
    };

    return {
      exportAttempts: [],
      id: `instance-${index}`,
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
    releaseThumbnail.mockResolvedValue(undefined);
    activateSource.mockImplementation(async (sourcePath: string) => ({
      displayName: sourcePath.split("/").at(-1) ?? sourcePath,
      sourcePath,
    }));
    inspectActiveSource.mockImplementation(async (sourcePath: string) => media(sourcePath));
    prepareActivePreview.mockResolvedValue({
      kind: "source",
      mediaToken: 3,
      url: "media://source",
    });
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
    for (const instance of instances) {
      store.dispatch(releaseImportedSourceThumbnailDemand(instance.id));
    }
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
    const [instance] = createInstances(1);
    if (!instance) throw new Error("Expected source fixture");
    const store = createAppStore();
    store.dispatch(editingInstancesAdded([instance]));
    store.dispatch(importedThumbnailReady({ instanceId: instance.id, thumbnail }));

    store.dispatch(prepareImportedSourceThumbnailsRequested([instance]));

    expect(prepareThumbnail).not.toHaveBeenCalled();
    store.dispatch(releaseImportedSourceThumbnailDemand(instance.id));
  });

  it("keeps a ready thumbnail active when its virtual card remounts", async () => {
    const instances = createInstances(IMPORTED_THUMBNAIL_POOL_LIMIT + 1);
    const store = createAppStore();
    store.dispatch(editingInstancesAdded(instances));
    instances.slice(0, -1).forEach((instance, index) => {
      store.dispatch(
        importedThumbnailReady({
          instanceId: instance.id,
          thumbnail: { mediaToken: index + 1, url: "media://thumbnail" },
        }),
      );
    });
    let nextToken = 100;
    prepareThumbnail.mockImplementation(async () => ({
      mediaToken: ++nextToken,
      url: "media://thumbnail",
    }));

    store.dispatch(prepareImportedSourceThumbnailsRequested([instances[0]!]));
    store.dispatch(prepareImportedSourceThumbnailsRequested([instances.at(-1)!]));

    await vi.waitFor(() =>
      expect(selectImportedSourceThumbnails(store.getState())[instances.at(-1)!.id]?.status).toBe(
        "ready",
      ),
    );
    expect(selectImportedSourceThumbnails(store.getState())[instances[0]!.id]?.status).toBe(
      "ready",
    );
    expect(releaseThumbnail).not.toHaveBeenCalledWith(1);

    for (const instance of instances) {
      store.dispatch(releaseImportedSourceThumbnailDemand(instance.id));
    }
  });

  it("keeps the runtime descriptor pool at its configured limit", async () => {
    const instances = createInstances(IMPORTED_THUMBNAIL_POOL_LIMIT + 8);
    const store = createAppStore();
    store.dispatch(editingInstancesAdded(instances));
    let nextToken = 10;
    prepareThumbnail.mockImplementation(async () => ({
      mediaToken: ++nextToken,
      url: "media://thumbnail",
    }));

    store.dispatch(prepareImportedSourceThumbnailsRequested(instances));

    await vi.waitFor(() =>
      expect(
        Object.values(selectImportedSourceThumbnails(store.getState())).filter(
          (state) => state.status === "ready",
        ),
      ).toHaveLength(IMPORTED_THUMBNAIL_POOL_LIMIT),
    );
    await vi.waitFor(() =>
      expect(releaseThumbnail).toHaveBeenCalledTimes(
        instances.length - IMPORTED_THUMBNAIL_POOL_LIMIT,
      ),
    );
    expect(Object.keys(selectImportedSourceThumbnails(store.getState()))).toHaveLength(
      IMPORTED_THUMBNAIL_POOL_LIMIT,
    );

    for (const instance of instances) {
      store.dispatch(releaseImportedSourceThumbnailDemand(instance.id));
    }
  });

  it("evicts the least recently used unneeded thumbnail and prepares it again when revisited", async () => {
    const instances = createInstances(IMPORTED_THUMBNAIL_POOL_LIMIT + 1);
    const store = createAppStore();
    store.dispatch(editingInstancesAdded(instances));
    let nextToken = 100;
    prepareThumbnail.mockImplementation(async () => ({
      mediaToken: ++nextToken,
      url: "media://thumbnail",
    }));
    store.dispatch(prepareImportedSourceThumbnailsRequested(instances.slice(0, -1)));
    await vi.waitFor(() =>
      expect(
        Object.values(selectImportedSourceThumbnails(store.getState())).filter(
          (state) => state.status === "ready",
        ),
      ).toHaveLength(IMPORTED_THUMBNAIL_POOL_LIMIT),
    );
    store.dispatch(releaseImportedSourceThumbnailDemand(instances[0]!.id));

    store.dispatch(prepareImportedSourceThumbnailsRequested([instances.at(-1)!]));
    await vi.waitFor(() =>
      expect(selectImportedSourceThumbnails(store.getState())[instances.at(-1)!.id]?.status).toBe(
        "ready",
      ),
    );
    expect(selectImportedSourceThumbnails(store.getState())[instances[0]!.id]).toBeUndefined();
    expect(releaseThumbnail).toHaveBeenCalledWith(101);

    store.dispatch(releaseImportedSourceThumbnailDemand(instances[1]!.id));
    store.dispatch(prepareImportedSourceThumbnailsRequested([instances[0]!]));
    await vi.waitFor(() =>
      expect(prepareThumbnail).toHaveBeenCalledTimes(IMPORTED_THUMBNAIL_POOL_LIMIT + 2),
    );
    await vi.waitFor(() =>
      expect(selectImportedSourceThumbnails(store.getState())[instances[0]!.id]?.status).toBe(
        "ready",
      ),
    );
    expect(prepareThumbnail).toHaveBeenLastCalledWith(instances[0]!.snapshot.source.sourcePath);

    for (const instance of instances) {
      store.dispatch(releaseImportedSourceThumbnailDemand(instance.id));
    }
  });

  it("releases the active native thumbnail token when a source is closed", async () => {
    const [instance] = createInstances(1);
    if (!instance) throw new Error("Expected source fixture");
    const store = createAppStore();
    store.dispatch(editingInstancesAdded([instance]));
    store.dispatch(importedThumbnailReady({ instanceId: instance.id, thumbnail }));

    store.dispatch(editingInstanceClosed(instance.id));

    await vi.waitFor(() =>
      expect(selectImportedSourceThumbnails(store.getState())[instance.id]).toBeUndefined(),
    );
    expect(releaseThumbnail).toHaveBeenCalledWith(thumbnail.mediaToken);
  });

  it("pauses background work during active-source preparation and resumes queued work", async () => {
    const instances = createInstances(41);
    const store = createAppStore();
    store.dispatch(editingInstancesAdded(instances));
    const pendingThumbnails: Array<ReturnType<typeof createDeferred<typeof thumbnail>>> = [];
    prepareThumbnail.mockImplementation(() => {
      const request = createDeferred<typeof thumbnail>();
      pendingThumbnails.push(request);
      return request.promise;
    });
    const activePreview = createDeferred<{ kind: "source"; mediaToken: number; url: string }>();
    prepareActivePreview.mockReturnValue(activePreview.promise);

    store.dispatch(prepareImportedSourceThumbnailsRequested(instances.slice(0, -1)));
    expect(prepareThumbnail).toHaveBeenCalledTimes(2);

    const activePreparation = store.dispatch(
      activateEditingInstanceRequested(instances[instances.length - 1]!),
    );

    await vi.waitFor(() => expect(inspectActiveSource).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(prepareActivePreview).toHaveBeenCalledTimes(1));

    pendingThumbnails.shift()?.resolve(thumbnail);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(prepareThumbnail).toHaveBeenCalledTimes(2);
    store.dispatch(releaseImportedSourceThumbnailDemand(instances[0]!.id));

    prepareThumbnail.mockResolvedValue(thumbnail);
    activePreview.resolve({ kind: "source", mediaToken: 3, url: "media://source" });
    await activePreparation;
    await vi.waitFor(() => expect(prepareThumbnail).toHaveBeenCalledTimes(40));
    pendingThumbnails.shift()?.resolve(thumbnail);
    await vi.waitFor(() =>
      expect(
        Object.values(selectImportedSourceThumbnails(store.getState())).filter(
          (state) => state.status === "ready",
        ),
      ).toHaveLength(40),
    );
    for (const instance of instances) {
      store.dispatch(releaseImportedSourceThumbnailDemand(instance.id));
    }
  });
});
