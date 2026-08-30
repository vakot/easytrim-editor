import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { importQueueItemAdded, selectImportQueueItems } from "@/app/store/slices/export-slice";
import { createAppStore } from "@/app/store/store";
import type { EditorSnapshot } from "@/domain/editor-snapshot";

const timeline = vi.hoisted(() => ({
  onSeek: vi.fn(),
}));

vi.mock("@/app/hooks/useTimeline", () => ({
  useTimeline: () => timeline,
}));

import { ImportQueue } from "../ImportQueue";

describe("ImportQueue", () => {
  it("removes an item without triggering its restore action", async () => {
    const appStore = createAppStore();
    const snapshot: EditorSnapshot = {
      audio: { master: { enabled: true, volumePercent: 50 }, mergeAudio: false, tracks: [] },
      crop: null,
      source: { displayName: "source.mp4", sourcePath: "C:/Media/source.mp4" },
      trim: { endMicros: 5_000_000, startMicros: 0 },
    };

    appStore.dispatch(
      importQueueItemAdded({
        id: "import-1",
        origin: "source-import",
        snapshot,
        status: "imported",
      }),
    );
    const user = userEvent.setup();

    render(
      <Provider store={appStore}>
        <ImportQueue />
      </Provider>,
    );

    const restoreButton = screen.getByRole("button", { name: "Restore source.mp4" });
    const removeButton = screen.getByRole("button", {
      name: "Remove source.mp4 from import queue",
    });

    expect(restoreButton).not.toContainElement(removeButton);
    await user.click(removeButton);

    expect(selectImportQueueItems(appStore.getState())).toEqual([]);
    expect(timeline.onSeek).not.toHaveBeenCalled();
  });
});
