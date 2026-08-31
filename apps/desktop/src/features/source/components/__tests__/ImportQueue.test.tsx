import { render, screen } from "@testing-library/react";
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
  useTimeline: () => timeline,
}));

vi.mock("@/lib/tauri/media", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tauri/media")>("@/lib/tauri/media");
  return { ...actual, moveSourceToTrash: media.moveSourceToTrash };
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

    render(
      <Provider store={appStore}>
        <ImportQueue />
      </Provider>,
    );

    expect(screen.getByRole("radio", { name: "Remove from queue" })).toBeChecked();
    const restoreCard = screen.getByLabelText("Restore source.mp4");
    const removeButton = screen.getByRole("button", {
      name: "Remove source.mp4 from import queue",
    });

    expect(restoreCard).toContainElement(removeButton);
    await user.click(removeButton);

    expect(selectImportQueueItems(appStore.getState())).toEqual([]);
    expect(timeline.onSeek).not.toHaveBeenCalled();
  });

  it("switches item actions without changing queue contents", async () => {
    const appStore = createAppStore();
    addQueueItem(appStore, "import-1", "first.mp4");
    addQueueItem(appStore, "import-2", "second.mp4");
    const user = userEvent.setup();

    render(
      <Provider store={appStore}>
        <ImportQueue />
      </Provider>,
    );

    await user.click(screen.getByRole("radio", { name: "Delete source" }));

    expect(
      screen.getByRole("button", { name: "Delete first.mp4 from device" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete second.mp4 from device" }),
    ).toBeInTheDocument();
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

    render(
      <Provider store={appStore}>
        <ImportQueue />
      </Provider>,
    );

    await user.click(screen.getByRole("radio", { name: "Delete source" }));
    await user.click(screen.getByRole("button", { name: "Delete first.mp4 from device" }));

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
});

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
