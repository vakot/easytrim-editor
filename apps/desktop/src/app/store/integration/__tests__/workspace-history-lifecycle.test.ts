import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  activateSourcePath: vi.fn(),
  inspectMedia: vi.fn(),
  moveSourceToTrash: vi.fn(),
  prepareSourcePreview: vi.fn(),
  restoreSourceFromTrash: vi.fn(),
}));

vi.mock("@/lib/tauri/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tauri/media")>()),
  ...native,
}));

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  applyHistoryPosition,
  redoWorkspaceHistory,
  undoWorkspaceHistory,
} from "@/app/store/integration/workspace-history";
import {
  editingInstanceDuplicated,
  editingInstanceExportAttemptQueued,
  editingInstancesAdded,
  editingInstancesSourceAvailabilityChanged,
  selectActiveInstanceId,
  selectEditingInstanceIds,
} from "@/app/store/slices/editing-instances-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import { selectWorkspaceHistory } from "@/app/store/slices/workspace-history-slice";
import { createAppStore } from "@/app/store/store";
import {
  closeEditingInstancesRequested,
  commitActiveEditingInstanceDraft,
  deleteActiveEditingInstanceSourceRequested,
  ingestSources,
  navigateToEditingInstance,
  restoreSourceFileRequested,
} from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance } from "@/domain/editing-instance";
import { createExportAttempt } from "@/domain/editing-instance";
import { firstSource, media, secondSource } from "@/test/source.fixtures";

beforeEach(() => {
  vi.clearAllMocks();
  native.activateSourcePath.mockImplementation(async (sourcePath: string) => ({
    displayName: sourcePath.split(/[\\/]/).at(-1) ?? sourcePath,
    sourcePath,
  }));
  native.prepareSourcePreview.mockResolvedValue({
    kind: "source",
    mediaToken: 1,
    url: "media://source",
  });
  native.inspectMedia.mockImplementation(async (sourcePath: string) => media(sourcePath));
  native.moveSourceToTrash.mockResolvedValue(undefined);
  native.restoreSourceFromTrash.mockResolvedValue(undefined);
});

const flush = async () => {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
};

function addInstances(ids = ["instance-a", "instance-b"]): ReturnType<typeof createAppStore> {
  const store = createAppStore();
  store.dispatch(
    editingInstancesAdded(
      [firstSource, secondSource].map((source, index): EditingInstance => ({
        exportAttempts: [],
        id: ids[index]!,
        media: media(source.sourcePath),
        origin: "source-import",
        snapshot: createDefaultEditorSnapshot(source),
        sourceAvailability: "available",
      })),
    ),
  );
  return store;
}

describe("workspace history source and instance lifecycle", () => {
  it("undoes and redoes imports with stable instance IDs across same-file instances", async () => {
    const store = createAppStore();
    store.dispatch(ingestSources([firstSource, firstSource]));
    await flush();
    const importedIds = selectEditingInstanceIds(store.getState());

    expect(importedIds).toHaveLength(2);
    expect(importedIds[0]).not.toBe(importedIds[1]);
    const operations = selectWorkspaceHistory(store.getState()).operations;
    expect(operations.some((operation) => operation.kind === "external")).toBe(true);
    expect(await store.dispatch(undoWorkspaceHistory())).toBe(true);
    expect(selectEditingInstanceIds(store.getState())).toEqual([]);
    expect(await store.dispatch(redoWorkspaceHistory())).toBe(true);
    expect(selectEditingInstanceIds(store.getState())).toEqual(importedIds);
  });

  it("navigates directly across import and edits that target the imported instance", async () => {
    const store = createAppStore();
    store.dispatch(ingestSources([firstSource]));
    await flush();
    const importedId = selectEditingInstanceIds(store.getState())[0]!;
    store.dispatch(
      trimChanged({
        trim: { startMicros: 200_000, endMicros: 4_500_000, sourceDurationMicros: 5_000_000 },
      }),
    );
    await flush();
    const finalPosition = selectWorkspaceHistory(store.getState()).operations.length;

    expect(await store.dispatch(applyHistoryPosition(0))).toBe(true);
    expect(store.getState().editingInstances.entities[importedId]).toBeUndefined();
    expect(await store.dispatch(applyHistoryPosition(finalPosition))).toBe(true);
    expect(store.getState().editingInstances.entities[importedId]?.snapshot.trim).toEqual({
      startMicros: 200_000,
      endMicros: 4_500_000,
    });
  });

  it("rolls history navigation back when the requested Editing Instance cannot activate", async () => {
    const store = addInstances();
    expect(await store.dispatch(navigateToEditingInstance("instance-a"))).toBe(true);
    store.dispatch(
      trimChanged({
        trim: { startMicros: 200_000, endMicros: 4_500_000, sourceDurationMicros: 5_000_000 },
      }),
    );
    await flush();
    store.dispatch(commitActiveEditingInstanceDraft());
    await flush();
    const beforeSnapshot = store.getState().editingInstances.entities["instance-a"]!.snapshot;
    const beforePosition = selectWorkspaceHistory(store.getState()).position;
    const historyLength = selectWorkspaceHistory(store.getState()).operations.length;
    native.activateSourcePath.mockRejectedValueOnce(new Error("source unavailable"));

    expect(await store.dispatch(applyHistoryPosition(0, true, "instance-b"))).toBe(false);
    expect(selectWorkspaceHistory(store.getState()).position).toBe(beforePosition);
    expect(selectWorkspaceHistory(store.getState()).operations).toHaveLength(historyLength);
    expect(selectActiveInstanceId(store.getState())).toBe("instance-a");
    expect(store.getState().editingInstances.entities["instance-a"]?.snapshot).toEqual(
      beforeSnapshot,
    );
  });

  it("activates the operation's Editing Instance without recording navigation", async () => {
    const store = addInstances();
    expect(await store.dispatch(navigateToEditingInstance("instance-a"))).toBe(true);
    store.dispatch(
      trimChanged({
        trim: { startMicros: 200_000, endMicros: 4_500_000, sourceDurationMicros: 5_000_000 },
      }),
    );
    await flush();
    const historyLength = selectWorkspaceHistory(store.getState()).operations.length;

    expect(await store.dispatch(applyHistoryPosition(0, true, "instance-b"))).toBe(true);
    expect(selectActiveInstanceId(store.getState())).toBe("instance-b");
    expect(selectWorkspaceHistory(store.getState()).position).toBe(0);
    expect(selectWorkspaceHistory(store.getState()).operations).toHaveLength(historyLength);
  });

  it("duplicates and closes instances reversibly without changing their identities", async () => {
    const store = addInstances();
    const duplicateId = "stable-duplicate-id";
    store.dispatch(
      editingInstanceDuplicated({
        ...store.getState().editingInstances.entities["instance-a"]!,
        id: duplicateId,
        origin: "duplicate",
        exportAttempts: [],
      }),
    );
    await flush();
    expect(store.getState().editingInstances.entities[duplicateId]?.snapshot.source).toEqual(
      firstSource,
    );

    expect(await store.dispatch(undoWorkspaceHistory())).toBe(true);
    expect(store.getState().editingInstances.entities[duplicateId]).toBeUndefined();
    expect(await store.dispatch(redoWorkspaceHistory())).toBe(true);
    expect(store.getState().editingInstances.entities[duplicateId]?.id).toBe(duplicateId);

    await store.dispatch(closeEditingInstancesRequested(["instance-a"]));
    expect(store.getState().editingInstances.entities["instance-a"]).toBeUndefined();
    expect(await store.dispatch(undoWorkspaceHistory())).toBe(true);
    expect(store.getState().editingInstances.entities["instance-a"]?.id).toBe("instance-a");
    expect(await store.dispatch(redoWorkspaceHistory())).toBe(true);
    expect(store.getState().editingInstances.entities["instance-a"]).toBeUndefined();
  });

  it("records source switching as navigation that ordinary Undo skips", async () => {
    const store = addInstances();
    expect(await store.dispatch(navigateToEditingInstance("instance-a"))).toBe(true);
    store.dispatch(
      trimChanged({
        trim: { startMicros: 100_000, endMicros: 4_000_000, sourceDurationMicros: 5_000_000 },
      }),
    );
    await flush();
    expect(await store.dispatch(navigateToEditingInstance("instance-b"))).toBe(true);
    const navigationCount = selectWorkspaceHistory(store.getState()).operations.filter(
      (operation) => operation.kind === "state" && operation.role === "navigation",
    ).length;

    expect(navigationCount).toBeGreaterThan(0);
    const ids = selectEditingInstanceIds(store.getState());
    expect(ids).toHaveLength(2);
    expect(selectActiveInstanceId(store.getState())).toBe("instance-b");
    expect(await store.dispatch(undoWorkspaceHistory())).toBe(true);
    expect(selectActiveInstanceId(store.getState())).toBe("instance-b");
    expect(store.getState().editingInstances.entities["instance-a"]?.snapshot.trim).toEqual({
      startMicros: 0,
      endMicros: 5_000_000,
    });
  });

  it("restores the prior source and leaves navigation history unchanged when activation fails", async () => {
    const store = addInstances();
    expect(await store.dispatch(navigateToEditingInstance("instance-a"))).toBe(true);
    const before = selectWorkspaceHistory(store.getState());
    native.activateSourcePath.mockRejectedValueOnce(new Error("source unavailable"));

    expect(await store.dispatch(navigateToEditingInstance("instance-b"))).toBe(false);
    expect(selectActiveInstanceId(store.getState())).toBe("instance-a");
    expect(selectWorkspaceHistory(store.getState())).toEqual(before);
  });

  it("undoes and redoes native deletion and restoration of the shared source file", async () => {
    const store = createAppStore();
    store.dispatch(
      editingInstancesAdded(
        ["same-file-a", "same-file-b"].map((id): EditingInstance => ({
          exportAttempts: [],
          id,
          media: media(firstSource.sourcePath),
          origin: "source-import",
          snapshot: createDefaultEditorSnapshot(firstSource),
          sourceAvailability: "available",
        })),
      ),
    );
    await store.dispatch(deleteActiveEditingInstanceSourceRequested("same-file-a"));
    expect(native.moveSourceToTrash).toHaveBeenCalledExactlyOnceWith(firstSource.sourcePath);
    expect(store.getState().editingInstances.entities["same-file-b"]?.sourceAvailability).toBe(
      "deleted",
    );
    expect(await store.dispatch(undoWorkspaceHistory())).toBe(true);
    expect(native.restoreSourceFromTrash).toHaveBeenCalledExactlyOnceWith(firstSource.sourcePath);
    expect(store.getState().editingInstances.entities["same-file-a"]?.sourceAvailability).toBe(
      "available",
    );
    expect(await store.dispatch(redoWorkspaceHistory())).toBe(true);
    expect(store.getState().editingInstances.entities["same-file-b"]?.sourceAvailability).toBe(
      "deleted",
    );
  });

  it("records explicit source restoration as a reversible native operation", async () => {
    const store = addInstances(["same-file-a", "same-file-b"]);
    store.dispatch(
      editingInstancesSourceAvailabilityChanged({
        availability: "deleted",
        sourcePath: firstSource.sourcePath,
      }),
    );
    expect(
      await store.dispatch(restoreSourceFileRequested({ sourcePath: firstSource.sourcePath })),
    ).toBe(true);
    expect(store.getState().editingInstances.entities["same-file-b"]?.sourceAvailability).toBe(
      "available",
    );
    expect(await store.dispatch(undoWorkspaceHistory())).toBe(true);
    expect(native.moveSourceToTrash).toHaveBeenCalledExactlyOnceWith(firstSource.sourcePath);
    expect(store.getState().editingInstances.entities["same-file-a"]?.sourceAvailability).toBe(
      "deleted",
    );
    expect(await store.dispatch(redoWorkspaceHistory())).toBe(true);
    expect(native.restoreSourceFromTrash).toHaveBeenCalledTimes(2);
  });

  it("does not advance history or alter availability when native deletion or restoration fails", async () => {
    const store = addInstances();
    native.moveSourceToTrash.mockRejectedValueOnce(new Error("move denied"));
    await store.dispatch(deleteActiveEditingInstanceSourceRequested("instance-a"));
    expect(selectWorkspaceHistory(store.getState()).operations).toHaveLength(0);
    expect(store.getState().editingInstances.entities["instance-a"]?.sourceAvailability).toBe(
      "available",
    );

    await store.dispatch(deleteActiveEditingInstanceSourceRequested("instance-a"));
    const position = selectWorkspaceHistory(store.getState()).position;
    native.restoreSourceFromTrash.mockRejectedValueOnce(new Error("restore denied"));
    expect(await store.dispatch(undoWorkspaceHistory())).toBe(false);
    expect(selectWorkspaceHistory(store.getState()).position).toBe(position);
    expect(store.getState().editingInstances.entities["instance-a"]?.sourceAvailability).toBe(
      "deleted",
    );
  });

  it("rejects replayed deletion while an export reserves the source", async () => {
    const store = createAppStore();
    store.dispatch(
      editingInstancesAdded([
        {
          exportAttempts: [],
          id: "reserved-source",
          media: media(firstSource.sourcePath),
          origin: "source-import",
          snapshot: createDefaultEditorSnapshot(firstSource),
          sourceAvailability: "available",
        },
      ]),
    );
    await store.dispatch(deleteActiveEditingInstanceSourceRequested("reserved-source"));
    expect(await store.dispatch(undoWorkspaceHistory())).toBe(true);
    const snapshot = createDefaultEditorSnapshot(firstSource);
    const attempt = createExportAttempt({
      capturedAt: 1,
      id: "queued-export",
      output: { displayName: "output.mp4", displayPath: "C:/output.mp4", outputId: "output" },
      request: {
        audioTracks: [],
        mergeAudio: false,
        rotationDegrees: 0,
        sourcePath: firstSource.sourcePath,
        trim: { endMicros: 5_000_000, startMicros: 0 },
      },
      route: "fast",
      snapshot,
    });

    store.dispatch(editingInstanceExportAttemptQueued({ id: "reserved-source", attempt }));

    const position = selectWorkspaceHistory(store.getState()).position;
    expect(await store.dispatch(redoWorkspaceHistory())).toBe(false);
    expect(selectWorkspaceHistory(store.getState()).position).toBe(position);
    expect(store.getState().editingInstances.entities["reserved-source"]?.sourceAvailability).toBe(
      "available",
    );
  });
});
