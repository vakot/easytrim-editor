import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";

import { importQueueItemAdded, selectImportQueueItems } from "@/app/store/slices/export-slice";
import { createAppStore } from "@/app/store/store";
import type { EditorSnapshot } from "@/domain/editor-snapshot";

const timeline = vi.hoisted(() => ({
  onSeek: vi.fn(),
}));

const media = vi.hoisted(() => ({
  moveSourceToTrash: vi.fn(),
  restoreSourceFromTrash: vi.fn(),
}));

vi.mock("@/app/hooks/useTimeline", () => ({
  useTimeline: () => timeline,
}));

vi.mock("@/lib/tauri/media", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tauri/media")>("@/lib/tauri/media");
  return {
    ...actual,
    moveSourceToTrash: media.moveSourceToTrash,
    restoreSourceFromTrash: media.restoreSourceFromTrash,
  };
});

import { ImportQueue } from "../ImportQueue";

describe("ImportQueue", () => {
  beforeEach(() => {
    media.moveSourceToTrash.mockReset();
    media.restoreSourceFromTrash.mockReset();
    toast.dismiss();
    timeline.onSeek.mockReset();
  });

  it("removes an item without triggering its restore action", async () => {
    const appStore = createAppStore();
    addQueueItem(appStore, "import-1", "source.mp4");
    const user = userEvent.setup();

    renderQueue(appStore);

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

    renderQueue(appStore);

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

    renderQueue(appStore);

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

  it("shows a restore action and restores only the deleted file", async () => {
    const appStore = createAppStore();
    addQueueItem(appStore, "import-1", "first.mp4");
    media.moveSourceToTrash.mockResolvedValue(undefined);
    let resolveRestore!: () => void;
    media.restoreSourceFromTrash.mockImplementation(
      () => new Promise<void>((resolve) => (resolveRestore = resolve)),
    );
    const user = userEvent.setup();

    renderQueue(appStore);

    await user.click(screen.getByRole("radio", { name: "Delete source" }));
    await user.click(screen.getByRole("button", { name: "Delete first.mp4 from device" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    const restoreButton = await screen.findByRole("button", { name: "Restore" });
    expect(screen.getByText("C:/Media/first.mp4")).toBeInTheDocument();
    expect(selectImportQueueItems(appStore.getState())).toEqual([]);

    await user.click(restoreButton);

    expect(media.restoreSourceFromTrash).toHaveBeenCalledWith("C:/Media/first.mp4");
    resolveRestore();
    expect(await screen.findByText("File restored")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(screen.getByText("File restored")).toBeInTheDocument();
    expect(selectImportQueueItems(appStore.getState())).toEqual([]);
  });

  it("shows delete progress before completing the operation", async () => {
    const appStore = createAppStore();
    addQueueItem(appStore, "import-1", "first.mp4");
    let resolveDelete!: () => void;
    media.moveSourceToTrash.mockImplementation(
      () => new Promise<void>((resolve) => (resolveDelete = resolve)),
    );
    const user = userEvent.setup();

    renderQueue(appStore);

    await user.click(screen.getByRole("radio", { name: "Delete source" }));
    await user.click(screen.getByRole("button", { name: "Delete first.mp4 from device" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Deleting first.mp4…")).toBeInTheDocument();
    expect(selectImportQueueItems(appStore.getState()).map((item) => item.id)).toEqual([
      "import-1",
    ]);

    resolveDelete();

    expect(await screen.findByText("File moved to trash")).toBeInTheDocument();
    expect(selectImportQueueItems(appStore.getState())).toEqual([]);
  });

  it("reports restore failures and prevents duplicate restore calls while pending", async () => {
    const appStore = createAppStore();
    addQueueItem(appStore, "import-1", "first.mp4");
    media.moveSourceToTrash.mockResolvedValue(undefined);
    let rejectRestore!: (reason: unknown) => void;
    media.restoreSourceFromTrash.mockImplementationOnce(
      () => new Promise<void>((_, reject) => (rejectRestore = reject)),
    );
    const user = userEvent.setup();

    renderQueue(appStore);

    await user.click(screen.getByRole("radio", { name: "Delete source" }));
    await user.click(screen.getByRole("button", { name: "Delete first.mp4 from device" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(await screen.findByRole("button", { name: "Restore" }));

    expect(await screen.findByText("Restoring first.mp4…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
    expect(media.restoreSourceFromTrash).toHaveBeenCalledTimes(1);

    rejectRestore(new Error("missing from trash"));

    expect(
      await screen.findByText("Could not restore first.mp4: missing from trash"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
  });

  it("reports delete failures without offering restore", async () => {
    const appStore = createAppStore();
    addQueueItem(appStore, "import-1", "first.mp4");
    media.moveSourceToTrash.mockRejectedValue(new Error("permission denied"));
    const user = userEvent.setup();

    renderQueue(appStore);

    await user.click(screen.getByRole("radio", { name: "Delete source" }));
    await user.click(screen.getByRole("button", { name: "Delete first.mp4 from device" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(
      await screen.findByText("Could not delete first.mp4: permission denied"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
    expect(selectImportQueueItems(appStore.getState()).map((item) => item.id)).toEqual([
      "import-1",
    ]);
  });
});

function renderQueue(appStore: ReturnType<typeof createAppStore>) {
  return render(
    <Provider store={appStore}>
      <ImportQueue />
      <Toaster duration={Infinity} position="bottom-right" theme="light" />
    </Provider>,
  );
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
