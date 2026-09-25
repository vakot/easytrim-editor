import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  activateSourcePath: vi.fn(),
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
import {
  activeEditingInstanceChanged,
  editingInstancesAdded,
  selectActiveEditingInstance,
  selectImportedEditingInstances,
} from "@/app/store/slices/editing-instances-slice";
import { selectPreview } from "@/app/store/slices/preview-slice";
import { selectSourceStatus } from "@/app/store/slices/source-slice";
import { createAppStore } from "@/app/store/store";
import { ingestSources, navigateToEditingInstance } from "@/app/store/thunks/source-media-thunks";
import { firstSource, media, secondSource } from "@/test/source.fixtures";

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
  it("publishes active loading state before deferred source activation", () => {
    vi.useFakeTimers();
    try {
      const store = createAppStore();
      store.dispatch(
        editingInstancesAdded([
          {
            id: "first",
            origin: "source-import",
            snapshot: createDefaultEditorSnapshot(firstSource, false),
            sourceAvailability: "available",
            exportAttempts: [],
          },
          {
            id: "second",
            origin: "source-import",
            snapshot: createDefaultEditorSnapshot(secondSource, false),
            sourceAvailability: "available",
            exportAttempts: [],
          },
        ]),
      );
      store.dispatch(activeEditingInstanceChanged("first"));
      store.dispatch(sourceSelected({ loadToken: 1, source: firstSource }));
      store.dispatch(sourceReady({ loadToken: 1, media: media(firstSource.sourcePath) }));

      expect(store.dispatch(navigateToEditingInstance("second"))).toBe(true);
      expect(store.getState().editingInstances.activeInstanceId).toBe("second");
      expect(selectSourceStatus(store.getState())).toBe("loading-source");
      expect(selectPreview(store.getState())).toMatchObject({ kind: "source", status: "loading" });
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("does not inspect media when imported sources are added", () => {
    const store = createAppStore();

    store.dispatch(ingestSources([firstSource, secondSource]));

    expect(native.inspectMedia).not.toHaveBeenCalled();
  });

  it("activates the first source from every newly imported batch", () => {
    const store = createAppStore();

    store.dispatch(ingestSources([firstSource]));
    expect(selectActiveEditingInstance(store.getState())?.snapshot).toEqual(
      createDefaultEditorSnapshot(firstSource, false),
    );

    store.dispatch(ingestSources([secondSource]));
    expect(selectActiveEditingInstance(store.getState())?.snapshot).toEqual(
      createDefaultEditorSnapshot(secondSource, false),
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
