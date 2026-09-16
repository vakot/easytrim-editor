import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { editingInstancesAdded } from "@/app/store/slices/editing-instances-slice";
import { queueStarted } from "@/app/store/slices/export-slice";
import { createAppStore } from "@/app/store/store";
import { createExportAttempt, type EditingInstance } from "@/domain/editing-instance";
import { firstSource } from "@/test/source.fixtures";

import {
  ExportQueueWidget,
  ExportQueueWidgetActive,
  ExportQueueWidgetActiveDetails,
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
      </ExportQueueWidget>
    </Provider>,
  );

  return store;
}

describe("ExportQueueWidget", () => {
  it("enables starting a paused queue from the featured item", () => {
    renderWidget();

    expect(screen.getByRole("button", { name: "Start queue" })).toBeEnabled();
  });

  it("disables starting when the queue is already running", async () => {
    const store = renderWidget();
    store.dispatch(queueStarted());

    await waitFor(() => expect(screen.getByRole("button", { name: "Start queue" })).toBeDisabled());
  });
});
