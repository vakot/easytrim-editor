import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  activateSourcePath: vi.fn(),
  inspectMedia: vi.fn(),
  prepareSourcePreview: vi.fn(),
}));

vi.mock("@/lib/tauri/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tauri/media")>()),
  ...native,
}));

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  createWorkspaceRecoveryBackup,
  getWorkspaceRecoveryCandidate,
  initializeWorkspaceRecovery,
} from "@/app/store/recovery/workspace-recovery";
import { restorePreviousWorkspaceRequested } from "@/app/store/recovery/workspace-recovery-thunks";
import {
  activeEditingInstanceChanged,
  editingInstancesAdded,
  selectEditingInstances,
} from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import { firstSource, media, secondSource } from "@/test/source.fixtures";

const CURRENT_KEY = "easytrim:workspace-recovery:current";
const CANDIDATE_KEY = "easytrim:workspace-recovery:candidate";

function instance(id: string, source: typeof firstSource) {
  return {
    exportAttempts: [],
    id,
    origin: "source-import" as const,
    snapshot: createDefaultEditorSnapshot(source, false),
    sourceAvailability: "available" as const,
  };
}

function prepareCandidate(activeId = "second") {
  const previousStore = createAppStore();
  previousStore.dispatch(
    editingInstancesAdded([instance("first", firstSource), instance("second", secondSource)]),
  );
  previousStore.dispatch(activeEditingInstanceChanged(activeId));
  localStorage.setItem(
    CURRENT_KEY,
    JSON.stringify(
      createWorkspaceRecoveryBackup(previousStore.getState(), { sessionId: "crashed-session" }),
    ),
  );
  const currentStore = createAppStore();
  initializeWorkspaceRecovery(currentStore, "current-session", true);
  return currentStore;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  native.activateSourcePath.mockImplementation(async (sourcePath: string) => {
    if (sourcePath === firstSource.sourcePath) throw new Error("Source no longer exists");
    return { displayName: sourcePath.split("/").at(-1) ?? sourcePath, sourcePath };
  });
  native.inspectMedia.mockImplementation(async (sourcePath: string) => media(sourcePath));
  native.prepareSourcePreview.mockResolvedValue({
    kind: "source",
    mediaToken: 1,
    url: "media://source",
  });
});

describe("restorePreviousWorkspaceRequested", () => {
  it("restores the saved active source through the normal media pipeline", async () => {
    native.activateSourcePath.mockImplementation(async (sourcePath: string) => ({
      displayName: sourcePath.split("/").at(-1) ?? sourcePath,
      sourcePath,
    }));
    const store = prepareCandidate();

    const result = await store.dispatch(restorePreviousWorkspaceRequested());

    expect(result).toBe(true);
    expect(selectEditingInstances(store.getState()).map(({ id }) => id)).toEqual([
      "first",
      "second",
    ]);
    expect(store.getState().editingInstances.activeInstanceId).toBe("second");
    expect(store.getState().source.status).toBe("ready");
    expect(store.getState().source.media).toEqual(media(secondSource.sourcePath));
    expect(getWorkspaceRecoveryCandidate()?.sessionId).toBe("crashed-session");
    expect(localStorage.getItem(CANDIDATE_KEY)).not.toBeNull();
  });

  it("restores remaining sources and falls back when the saved active source is unavailable", async () => {
    const store = prepareCandidate("first");

    const result = await store.dispatch(restorePreviousWorkspaceRequested());

    expect(result).toBe(true);
    expect(selectEditingInstances(store.getState()).map(({ id }) => id)).toEqual(["second"]);
    expect(store.getState().editingInstances.activeInstanceId).toBe("second");
    expect(store.getState().source.status).toBe("ready");
    expect(getWorkspaceRecoveryCandidate()?.instances).toHaveLength(2);
  });
});
