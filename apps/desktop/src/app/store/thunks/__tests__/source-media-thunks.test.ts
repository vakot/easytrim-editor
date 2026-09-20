import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  activateSourcePath: vi.fn(),
  inspectImportedSource: vi.fn(),
  inspectMedia: vi.fn(),
  prepareSourcePreview: vi.fn(),
}));

vi.mock("@/lib/tauri/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tauri/media")>()),
  ...native,
}));

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  selectActiveEditingInstance,
  selectImportedEditingInstances,
} from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import { ingestSources } from "@/app/store/thunks/source-media-thunks";
import { firstSource, media, secondSource } from "@/test/source.fixtures";

beforeEach(() => {
  vi.clearAllMocks();
  native.activateSourcePath.mockImplementation(async (sourcePath: string) => ({
    displayName: sourcePath.split("/").at(-1) ?? sourcePath,
    sourcePath,
  }));
  native.inspectImportedSource.mockResolvedValue(media(firstSource.sourcePath));
  native.inspectMedia.mockResolvedValue(media(firstSource.sourcePath));
  native.prepareSourcePreview.mockResolvedValue({
    kind: "source",
    mediaToken: 1,
    url: "media://source",
  });
});

describe("source import workflow", () => {
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
