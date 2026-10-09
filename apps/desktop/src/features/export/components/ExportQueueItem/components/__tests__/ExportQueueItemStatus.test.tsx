import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { editingInstancesAdded } from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import { createExportAttempt } from "@/domain/editing-instance";
import { firstSource } from "@/test/source.fixtures";

import { ExportQueueItem } from "../../ExportQueueItem";
import { ExportQueueItemStatus } from "../ExportQueueItemStatus";

describe("ExportQueueItemStatus", () => {
  it("shows a failed attempt's localized error and diagnostics when keyboard focused", async () => {
    const snapshot = createDefaultEditorSnapshot(firstSource, false);
    const attempt = createExportAttempt({
      capturedAt: 1,
      id: "failed-export",
      output: {
        displayName: "output.mp4",
        displayPath: "C:/Exports/output.mp4",
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
    });
    const error = {
      code: "render_failed",
      diagnostics: "Invalid data found when processing input",
      messageId: "export.ffmpegCouldNotRenderTheSelectedSegment",
    };
    const store = createAppStore();
    store.dispatch(
      editingInstancesAdded([
        {
          exportAttempts: [
            { ...attempt, state: { error, failedAt: 2, status: "failed" as const } },
          ],
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
          <ExportQueueItemStatus />
        </ExportQueueItem>
      </Provider>,
    );

    const user = userEvent.setup();
    await user.tab();

    expect(screen.getByText("FFmpeg could not render the selected segment")).toBeInTheDocument();
    expect(screen.getByText("Technical details")).toBeInTheDocument();
    expect(screen.getByText(error.diagnostics)).toBeInTheDocument();
  });
});
