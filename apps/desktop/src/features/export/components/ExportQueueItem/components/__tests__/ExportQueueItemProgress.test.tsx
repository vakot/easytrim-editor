import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { editingInstancesAdded } from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import { createExportAttempt, type ExportAttempt } from "@/domain/editing-instance";
import { firstSource } from "@/test/source.fixtures";

import { ExportQueueItem } from "../../ExportQueueItem";
import { ExportQueueItemProgressBar } from "../ExportQueueItemProgress";

describe("ExportQueueItemProgressBar", () => {
  it("calculates GIF progress from FFmpeg's frame count", () => {
    const progress = renderProgressBar({
      currentFrame: 50,
      phase: "preparing",
      progressPercent: 0,
    });

    expect(progress).toHaveAttribute("data-state", "loading");
    expect(progress).toHaveAttribute("aria-valuenow", "25");
  });

  it("shows indeterminate progress only when no progress value can be calculated", () => {
    const progress = renderProgressBar({ phase: "preparing", progressPercent: 0 });

    expect(progress).toHaveAttribute("data-state", "indeterminate");
    expect(progress).not.toHaveAttribute("aria-valuetext");
  });
});

function renderProgressBar(metrics: Partial<ExportAttempt["metrics"]>) {
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
    totalFrames: 200,
  });

  const renderingAttempt: ExportAttempt = {
    ...attempt,
    metrics: { ...attempt.metrics, ...metrics },
    state: { operationId: "gif-operation", startedAt: 2, status: "rendering" },
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

  return screen.getByRole("progressbar", { name: "Export progress" });
}
