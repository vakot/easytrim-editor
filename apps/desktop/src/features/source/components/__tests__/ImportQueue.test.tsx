import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { importQueueItemAdded, selectImportQueueItems } from "@/app/store/slices/export-slice";
import { createAppStore } from "@/app/store/store";
import type { EditorSnapshot } from "@/domain/editor-snapshot";

const timeline = vi.hoisted(() => ({
  onSeek: vi.fn(),
}));

const media = vi.hoisted(() => ({
  moveSourceToTrash: vi.fn(),
}));

vi.mock("@/app/hooks/useTimeline", () => ({
  useTimelineCommands: () => timeline,
}));

vi.mock("@/lib/tauri/media", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tauri/media")>("@/lib/tauri/media");
  return {
    ...actual,
    moveSourceToTrash: media.moveSourceToTrash,
  };
});

import { ImportQueue } from "../ImportQueue";

describe("ImportQueue", () => {
  beforeEach(() => {
    media.moveSourceToTrash.mockReset();
    timeline.onSeek.mockReset();
  });

  it("removes an item without triggering its restore action", async () => {
    const appStore = createAppStore();
    addQueueItem(appStore, "import-1", "source.mp4");
    const user = userEvent.setup();

    renderQueue(appStore);

    const restoreCard = screen.getByLabelText("Restore source.mp4");
    const removeButton = screen.getByRole("button", {
      name: "Remove source.mp4 from import queue",
    });

    expect(restoreCard).toContainElement(removeButton);
    await user.click(removeButton);

    expect(selectImportQueueItems(appStore.getState())).toEqual([]);
    expect(timeline.onSeek).not.toHaveBeenCalled();
  });

  it("shows both item actions without changing queue contents", () => {
    const appStore = createAppStore();
    addQueueItem(appStore, "import-1", "first.mp4");
    addQueueItem(appStore, "import-2", "second.mp4");
    renderQueue(appStore);

    expect(getQueueItemButton("first.mp4", "Delete first.mp4 from device")).toBeInTheDocument();
    expect(getQueueItemButton("second.mp4", "Delete second.mp4 from device")).toBeInTheDocument();
    expect(selectImportQueueItems(appStore.getState()).map((item) => item.id)).toEqual([
      "import-1",
      "import-2",
    ]);
  });

  it("opens delete confirmation for the clicked item and preserves propagation behavior", async () => {
    const appStore = createAppStore();
    addQueueItem(appStore, "import-1", "first.mp4");
    addQueueItem(appStore, "import-2", "second.mp4");
    media.moveSourceToTrash.mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderQueue(appStore);

    await user.click(getQueueItemButton("first.mp4", "Delete first.mp4 from device"));

    expect(
      screen.getByText("This deletes first.mp4 from your computer. This action can be undone."),
    ).toBeInTheDocument();
    expect(timeline.onSeek).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(media.moveSourceToTrash).toHaveBeenCalledWith("C:/Media/first.mp4");
    expect(selectImportQueueItems(appStore.getState()).map((item) => item.id)).toEqual([
      "import-2",
    ]);
    expect(appStore.getState().export.activeItemId).toBe("import-2");
  });

  it("keeps an item in the queue when deleting the source fails", async () => {
    const appStore = createAppStore();
    addQueueItem(appStore, "import-1", "first.mp4");
    media.moveSourceToTrash.mockRejectedValue(new Error("permission denied"));
    const user = userEvent.setup();

    renderQueue(appStore);

    await user.click(getQueueItemButton("first.mp4", "Delete first.mp4 from device"));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(media.moveSourceToTrash).toHaveBeenCalledWith("C:/Media/first.mp4");
    expect(selectImportQueueItems(appStore.getState()).map((item) => item.id)).toEqual([
      "import-1",
    ]);
  });
});

function renderQueue(appStore: ReturnType<typeof createAppStore>) {
  return render(
    <Provider store={appStore}>
      <ImportQueue />
    </Provider>,
  );
}

function getQueueItemButton(filename: string, name: string) {
  return within(screen.getByLabelText(`Restore ${filename}`)).getByRole("button", { name });
}

function addQueueItem(
  appStore: ReturnType<typeof createAppStore>,
  id: string,
  displayName: string,
) {
  const snapshot: EditorSnapshot = {
    audio: { master: { enabled: true, volumePercent: 50 }, mergeAudio: false, tracks: [] },
    crop: null,
    source: { displayName, sourcePath: `C:/Media/${displayName}` },
    trim: { endMicros: 5_000_000, startMicros: 0 },
  };

  appStore.dispatch(
    importQueueItemAdded({
      id,
      origin: "source-import",
      snapshot,
      status: "imported",
    }),
  );
}
