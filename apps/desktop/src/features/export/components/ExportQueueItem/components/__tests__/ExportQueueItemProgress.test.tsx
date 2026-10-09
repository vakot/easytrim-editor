import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { editingInstancesAdded } from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import { createExportAttempt } from "@/domain/editing-instance";
import { firstSource } from "@/test/source.fixtures";

import { ExportQueueItem } from "../../ExportQueueItem";
import { ExportQueueItemProgressBar } from "../ExportQueueItemProgress";

describe("ExportQueueItemProgressBar", () => {
  it("shows GIF rendering as indeterminate regardless of the progress phase", () => {
    const snapshot = createDefaultEditorSnapshot(firstSource, false);
    const attempt = createExportAttempt({
      capturedAt: 1,
      id: "gif-export",
      output: {
        displayName: "output.gif",
        displayPath: "C:/Exports/output.gif",
        outputId: "output-1",
      },
      request: {
        audioTracks: [],
        flipHorizontal: false,
        flipVertical: false,
        mergeAudio: false,
        resolution: { height: 360, width: 640 },
        rotationDegrees: 0,
        sourcePath: firstSource.sourcePath,
        trim: { endMicros: 1_000_000, startMicros: 0 },
      },
      route: "gif",
      snapshot,
    });

    const renderingAttempt = {
      ...attempt,
      metrics: { ...attempt.metrics, phase: "running" as const, progressPercent: 42 },
      state: { operationId: "gif-operation", startedAt: 2, status: "rendering" as const },
    };

    const store = createAppStore();
    store.dispatch(
      editingInstancesAdded([
        {
          exportAttempts: [renderingAttempt],
          id: "source-1",
          origin: "source-import",
          snapshot,
          sourceAvailability: "available",
        },
      ]),
    );

    render(
      <Provider store={store}>
        <ExportQueueItem attemptId={attempt.id} instanceId="source-1">
          <ExportQueueItemProgressBar />
        </ExportQueueItem>
      </Provider>,
    );

    const progress = screen.getByRole("progressbar", { name: "Export progress" });
    expect(progress).toHaveAttribute("data-state", "indeterminate");
    expect(progress).not.toHaveAttribute("aria-valuetext");
  });
});
