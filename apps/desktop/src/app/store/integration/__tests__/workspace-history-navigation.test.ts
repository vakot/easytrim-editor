import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  activateSourcePath: vi.fn(),
  inspectMedia: vi.fn(),
  prepareSourcePreview: vi.fn(),
  moveSourceToTrash: vi.fn(),
  restoreSourceFromTrash: vi.fn(),
}));

vi.mock("@/lib/tauri/media", async (original) => ({
  ...(await original<typeof import("@/lib/tauri/media")>()),
  ...native,
}));

import {
  createDefaultEditorSnapshot,
  historyProjection,
} from "@/app/store/integration/editor-snapshot";
import { applyHistoryPosition } from "@/app/store/integration/workspace-history";
import {
  currentHistorySnapshot,
  resolveHistoryDestination,
} from "@/app/store/integration/workspace-history-resolution";
import {
  editingInstanceDuplicated,
  editingInstancesAdded,
} from "@/app/store/slices/editing-instances-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import { selectWorkspaceHistory } from "@/app/store/slices/workspace-history-slice";
import { createAppStore, type RootState } from "@/app/store/store";
import {
  closeEditingInstancesRequested,
  commitActiveEditingInstanceDraft,
  deleteActiveEditingInstanceSourceRequested,
  navigateToEditingInstance,
  restoreSourceFileRequested,
} from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance } from "@/domain/editing-instance";
import type { HistoryOperation } from "@/domain/workspace-history";
import { firstSource, media, secondSource } from "@/test/source.fixtures";

beforeEach(() => {
  vi.resetAllMocks();
  native.activateSourcePath.mockImplementation(async (sourcePath: string) => ({
    sourcePath,
    displayName: sourcePath.split("/").at(-1)!,
  }));
  native.inspectMedia.mockImplementation(async (path: string) => media(path));
  native.prepareSourcePreview.mockResolvedValue({
    kind: "source",
    mediaToken: 1,
    url: "media://source",
  });
  native.moveSourceToTrash.mockResolvedValue(undefined);
  native.restoreSourceFromTrash.mockResolvedValue(undefined);
});

function setup() {
  const store = createAppStore();
  store.dispatch(
    editingInstancesAdded(
      [firstSource, secondSource].map((source, index): EditingInstance => ({
        id: index === 0 ? "a" : "b",
        origin: "source-import",
        exportAttempts: [],
        sourceAvailability: "available",
        media: media(source.sourcePath),
        snapshot: createDefaultEditorSnapshot(source),
      })),
    ),
  );
  return store;
}

function semantic(state: RootState) {
  return {
    active: state.editingInstances.activeInstanceId,
    instances: state.editingInstances.ids.map((id) => {
      const instance = state.editingInstances.entities[id]!;
      const snapshot = currentHistorySnapshot(state, id)!;
      const trim =
        "kind" in snapshot.trim
          ? { startMicros: 0, endMicros: instance.media?.durationMicros ?? 5_000_000 }
          : snapshot.trim;

      return {
        id,
        sourceAvailability: instance.sourceAvailability,
        source: snapshot.source,
        optimizedSettings: instance.optimizedSettings,
        gifSettings: instance.gifSettings,
        ...historyProjection({ ...snapshot, trim }),
      };
    }),
  };
}

describe("resolved workspace history navigation", () => {
  it("updates only final snapshot fields without rebuilding unrelated instances or source entries", async () => {
    const store = setup();
    await store.dispatch(navigateToEditingInstance("a"));
    store.dispatch(
      trimChanged({
        trim: { startMicros: 100_000, endMicros: 4_000_000, sourceDurationMicros: 5_000_000 },
      }),
    );
    store.dispatch(commitActiveEditingInstanceDraft());
    const before = store.getState();
    native.activateSourcePath.mockClear();
    expect(await store.dispatch(applyHistoryPosition(1))).toBe(true);
    const after = store.getState();
    expect(after.source).toBe(before.source);
    expect(after.editingInstances.entities.b).toBe(before.editingInstances.entities.b);
    expect(after.editingInstances.sourceSearchEntries).toBe(
      before.editingInstances.sourceSearchEntries,
    );
    expect(after.editingInstances.sourceListEntries.map(({ id }) => id)).toEqual(["a", "b"]);
    expect(native.activateSourcePath).not.toHaveBeenCalled();
  });

  it("restores and activates a destination instance absent from the current workspace exactly once", async () => {
    const store = setup();
    await store.dispatch(navigateToEditingInstance("a"));
    store.dispatch(
      editingInstanceDuplicated({
        ...store.getState().editingInstances.entities.a!,
        id: "duplicate",
        origin: "duplicate",
        exportAttempts: [],
        optimizedSettings: { frameRate: undefined, resolution: { width: 1280, height: 720 } },
      }),
    );
    const target = selectWorkspaceHistory(store.getState()).position;
    await store.dispatch(closeEditingInstancesRequested(["duplicate"]));
    expect(store.getState().editingInstances.entities.duplicate).toBeUndefined();
    native.activateSourcePath.mockClear();
    native.inspectMedia.mockClear();
    expect(await store.dispatch(applyHistoryPosition(target, true, "duplicate"))).toBe(true);
    expect(store.getState().editingInstances.activeInstanceId).toBe("duplicate");
    expect(store.getState().editingInstances.ids).toEqual(["a", "b", "duplicate"]);
    expect(
      store.getState().editingInstances.entities.duplicate?.optimizedSettings?.resolution,
    ).toEqual({ width: 1280, height: 720 });
    expect(native.activateSourcePath).toHaveBeenCalledTimes(1);
    expect(native.inspectMedia).toHaveBeenCalledTimes(1);
  });

  it("collapses 100 source switches into one final activation and one visible semantic commit", async () => {
    const store = setup();
    for (let index = 0; index < 100; index++)
      expect(await store.dispatch(navigateToEditingInstance(index % 2 ? "b" : "a"))).toBe(true);
    const history = selectWorkspaceHistory(store.getState());
    expect(history.operations).toHaveLength(100);
    native.activateSourcePath.mockClear();
    native.inspectMedia.mockClear();
    native.prepareSourcePreview.mockClear();
    const visible: string[] = [];
    const unsubscribe = store.subscribe(() =>
      visible.push(
        JSON.stringify({
          ...semantic(store.getState()),
          position: selectWorkspaceHistory(store.getState()).position,
        }),
      ),
    );

    expect(await store.dispatch(applyHistoryPosition(1))).toBe(true);
    unsubscribe();
    expect(native.activateSourcePath).toHaveBeenCalledExactlyOnceWith(
      firstSource.sourcePath,
      expect.anything(),
    );
    expect(native.prepareSourcePreview).toHaveBeenCalledTimes(1);
    expect(native.inspectMedia).not.toHaveBeenCalled();
    expect(new Set(visible).size).toBe(2); // Unchanged state while busy, then the complete destination.
    expect(store.getState().editingInstances.activeInstanceId).toBe("a");
    expect(selectWorkspaceHistory(store.getState()).operations).toEqual(history.operations);
    native.activateSourcePath.mockClear();
    native.prepareSourcePreview.mockClear();
    expect(await store.dispatch(applyHistoryPosition(0))).toBe(true);
    expect(native.activateSourcePath).not.toHaveBeenCalled();
    expect(native.prepareSourcePreview).not.toHaveBeenCalled();
    expect(store.getState().editingInstances.activeInstanceId).toBeNull();
  });

  it("keeps live state intact while the single destination loads, and commits its cursor with it", async () => {
    const store = setup();
    await store.dispatch(navigateToEditingInstance("a"));
    await store.dispatch(navigateToEditingInstance("b"));
    const before = semantic(store.getState());
    let complete!: (source: typeof firstSource) => void;
    native.activateSourcePath.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const pending = store.dispatch(applyHistoryPosition(1));
    expect(semantic(store.getState())).toEqual(before);
    expect(selectWorkspaceHistory(store.getState()).position).toBe(2);
    complete(firstSource);
    expect(await pending).toBe(true);
    expect(store.getState().source.status).toBe("ready");
    expect(store.getState().editingInstances.activeInstanceId).toBe("a");
    expect(selectWorkspaceHistory(store.getState()).position).toBe(1);
  });

  it.each(["activation", "preview"])(
    "preserves workspace and runtime state after final %s failure without reloading the original",
    async (failure) => {
      const store = setup();
      await store.dispatch(navigateToEditingInstance("a"));
      await store.dispatch(navigateToEditingInstance("b"));
      const before = store.getState();
      native.activateSourcePath.mockClear();
      if (failure === "activation")
        native.activateSourcePath.mockRejectedValueOnce(new Error("unavailable"));
      else native.prepareSourcePreview.mockRejectedValueOnce(new Error("preview failed"));
      expect(await store.dispatch(applyHistoryPosition(1))).toBe(false);
      const after = store.getState();
      for (const key of ["editingInstances", "source", "audio", "trim", "crop", "preview"] as const)
        expect(after[key]).toBe(before[key]);
      expect(selectWorkspaceHistory(after)).toEqual(selectWorkspaceHistory(before));
      expect(native.activateSourcePath).toHaveBeenCalledTimes(1);
      expect(after.workspaceHistory.replaying).toBe(false);
    },
  );

  it("rejects a stale destination instead of overwriting a concurrent workspace change", async () => {
    const store = setup();
    await store.dispatch(navigateToEditingInstance("a"));
    await store.dispatch(navigateToEditingInstance("b"));
    let complete!: (source: typeof firstSource) => void;
    native.activateSourcePath.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const pending = store.dispatch(applyHistoryPosition(1));
    store.dispatch(
      editingInstancesAdded([
        { ...store.getState().editingInstances.entities.b!, id: "concurrent-import" },
      ]),
    );
    complete(firstSource);
    expect(await pending).toBe(false);
    expect(store.getState().editingInstances.ids).toEqual(["a", "b", "concurrent-import"]);
    expect(store.getState().editingInstances.activeInstanceId).toBe("b");
    expect(selectWorkspaceHistory(store.getState()).position).toBe(2);
    expect(store.getState().workspaceHistory.replaying).toBe(false);
  });

  it("avoids filesystem operations when deletion and restoration have no net effect", async () => {
    const store = setup();
    await store.dispatch(navigateToEditingInstance("b"));
    const start = selectWorkspaceHistory(store.getState()).position;
    await store.dispatch(deleteActiveEditingInstanceSourceRequested("a"));
    store.dispatch(
      trimChanged({
        trim: { startMicros: 200_000, endMicros: 4_000_000, sourceDurationMicros: 5_000_000 },
      }),
    );
    await store.dispatch(restoreSourceFileRequested({ sourcePath: firstSource.sourcePath }));
    const tip = selectWorkspaceHistory(store.getState()).position;
    native.moveSourceToTrash.mockClear();
    native.restoreSourceFromTrash.mockClear();
    native.activateSourcePath.mockClear();
    native.moveSourceToTrash.mockRejectedValue(new Error("must not delete an intermediate state"));
    expect(await store.dispatch(applyHistoryPosition(start))).toBe(true);
    expect(await store.dispatch(applyHistoryPosition(tip))).toBe(true);
    expect(native.moveSourceToTrash).not.toHaveBeenCalled();
    expect(native.restoreSourceFromTrash).not.toHaveBeenCalled();
    expect(native.activateSourcePath).not.toHaveBeenCalled();
    expect(store.getState().trim.value?.startMicros).toBe(200_000);
  });

  it("matches sequential semantic results for interleaved inactive edits, duplications, and closures", async () => {
    async function scenario() {
      const store = setup();
      for (let index = 0; index < 25; index++) {
        await store.dispatch(navigateToEditingInstance(index % 2 ? "b" : "a"));
        store.dispatch(
          trimChanged({
            trim: {
              startMicros: index * 1000,
              endMicros: 4_000_000,
              sourceDurationMicros: 5_000_000,
            },
          }),
        );
        store.dispatch(commitActiveEditingInstanceDraft());
        if (index % 5 === 0) {
          const id = `duplicate-${index}`;
          store.dispatch(
            editingInstanceDuplicated({
              ...store.getState().editingInstances.entities.a!,
              id,
              origin: "duplicate",
              exportAttempts: [],
            }),
          );
          await store.dispatch(closeEditingInstancesRequested([id]));
        }
      }
      return store;
    }
    const direct = await scenario();
    const sequential = await scenario();
    const tip = selectWorkspaceHistory(direct.getState()).position;
    const atTip = semantic(direct.getState());
    native.activateSourcePath.mockClear();
    expect(await direct.dispatch(applyHistoryPosition(0))).toBe(true);
    expect(native.activateSourcePath).not.toHaveBeenCalled();
    for (let position = tip - 1; position >= 0; position--)
      expect(await sequential.dispatch(applyHistoryPosition(position))).toBe(true);
    expect(semantic(direct.getState())).toEqual(semantic(sequential.getState()));
    const beforeForward = native.activateSourcePath.mock.calls.length;
    expect(await direct.dispatch(applyHistoryPosition(tip))).toBe(true);
    expect(native.activateSourcePath.mock.calls.length - beforeForward).toBe(1);
    for (let position = 1; position <= tip; position++)
      expect(await sequential.dispatch(applyHistoryPosition(position))).toBe(true);
    expect(semantic(direct.getState())).toEqual(semantic(sequential.getState()));
    expect(semantic(direct.getState())).toEqual(atTip);
  });

  it("resolves thousands of navigation and inactive field changes purely in memory", async () => {
    const store = setup();
    await store.dispatch(navigateToEditingInstance("a"));
    const state = store.getState();
    const operations: HistoryOperation[] = [];
    let active = "a";
    const rotations = { a: 0, b: 0 };
    for (let index = 0; index < 1001; index++) {
      const next = active === "a" ? "b" : "a";
      operations.push({
        id: `switch-${index}`,
        label: "Switch",
        timestamp: index,
        kind: "state",
        role: "navigation",
        changes: [
          {
            target: { kind: "workspace" },
            field: "activeInstanceId",
            before: { present: true, value: active },
            after: { present: true, value: next },
          },
        ],
      });
      const id = active as "a" | "b";
      const after = (rotations[id] + 90) % 360;
      operations.push({
        id: `edit-${index}`,
        label: "Rotate",
        timestamp: index,
        kind: "state",
        role: "edit",
        changes: [
          {
            field: "rotation",
            target: {
              kind: "instance",
              instanceId: id,
              sourceId: id === "a" ? firstSource.sourcePath : secondSource.sourcePath,
            },
            before: { present: true, value: rotations[id] },
            after: { present: true, value: after },
          },
        ],
      });
      rotations[id] = after;
      active = next;
    }
    native.activateSourcePath.mockClear();
    native.prepareSourcePreview.mockClear();
    const resolved = resolveHistoryDestination(
      { ...state, workspaceHistory: { ...state.workspaceHistory, operations, position: 0 } },
      operations.length,
      true,
    );

    expect(resolved?.activeInstanceId).toBe(active);
    expect(resolved?.instances.map(({ id, snapshot }) => [id, snapshot.rotation])).toEqual([
      ["a", rotations.a],
      ["b", rotations.b],
    ]);
    expect(native.activateSourcePath).not.toHaveBeenCalled();
    expect(native.prepareSourcePreview).not.toHaveBeenCalled();
    expect(state.editingInstances.entities.a?.snapshot.rotation).toBe(0);
  });
});
