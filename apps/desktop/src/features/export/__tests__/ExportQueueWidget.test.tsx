import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  editingInstanceExportStarted,
  editingInstancesAdded,
  selectImportedEditingInstances,
} from "@/app/store/slices/editing-instances-slice";
import { queueStarted } from "@/app/store/slices/export-slice";
import { createAppStore } from "@/app/store/store";
import { createExportAttempt, type EditingInstance } from "@/domain/editing-instance";
import { firstSource } from "@/test/source.fixtures";

import {
  ExportQueueWidget,
  ExportQueueWidgetActive,
  ExportQueueWidgetActiveDetails,
  ExportQueueWidgetPendingList,
  ExportQueueWidgetPendingListEmpty,
} from "../ExportQueueWidget";

function createQueuedInstance(): EditingInstance {
  const snapshot = createDefaultEditorSnapshot(firstSource, false);

  return {
    exportAttempts: [
      createExportAttempt({
        capturedAt: 1,
        id: "attempt-1",
        output: {
          displayName: "export.mp4",
          displayPath: "C:/Exports/export.mp4",
          outputId: "output-1",
        },
        request: {
          audioTracks: [],
          mergeAudio: false,
          rotationDegrees: 0,
          sourcePath: firstSource.sourcePath,
          trim: { endMicros: 1_000_000, startMicros: 0 },
        },
        route: "fast",
        snapshot,
      }),
    ],
    id: "instance-1",
    origin: "source-import",
    snapshot,
    sourceAvailability: "available",
  };
}

function renderWidget() {
  const store = createAppStore();
  store.dispatch(editingInstancesAdded([createQueuedInstance()]));

  render(
    <Provider store={store}>
      <ExportQueueWidget>
        <ExportQueueWidgetActive>
          <ExportQueueWidgetActiveDetails />
        </ExportQueueWidgetActive>
        <ExportQueueWidgetPendingListEmpty />
        <ExportQueueWidgetPendingList />
      </ExportQueueWidget>
    </Provider>,
  );

  return store;
}

describe("ExportQueueWidget", () => {
  it("restores the featured pending item into a new draft", async () => {
    const store = renderWidget();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Edit: export.mp4" }));
    });
    expect(store.getState().editingInstances.entities["instance-1"]?.exportAttempts).toEqual([]);
    expect(selectImportedEditingInstances(store.getState())).toHaveLength(2);
    expect(store.getState().editingInstances.activeInstanceId).not.toBe("instance-1");
  });

  it("disables restoration when the featured export is rendering", () => {
    const store = renderWidget();
    act(() =>
      store.dispatch(
        editingInstanceExportStarted({ id: "instance-1", attemptId: "attempt-1", startedAt: 1 }),
      ),
    );
    expect(screen.getByRole("button", { name: "Edit: export.mp4" })).toBeDisabled();
  });
  it("enables starting a paused queue from the featured item", () => {
    renderWidget();

    expect(screen.getByRole("button", { name: "Start queue" })).toBeEnabled();
  });

  it("shows an empty state when no pending exports remain", () => {
    renderWidget();

    expect(screen.getByText("No pending exports.")).toBeInTheDocument();
  });

  it("disables starting when the queue is already running", async () => {
    const store = renderWidget();
    store.dispatch(queueStarted());

    await waitFor(() => expect(screen.getByRole("button", { name: "Start queue" })).toBeDisabled());
  });
});
