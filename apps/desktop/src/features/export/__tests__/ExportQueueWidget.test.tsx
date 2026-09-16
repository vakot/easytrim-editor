import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  editingInstanceExportAttemptQueued,
  editingInstanceExportProgressReceived,
  editingInstanceExportStarted,
  editingInstancesAdded,
} from "@/app/store/slices/editing-instances-slice";
import { importedThumbnailReady } from "@/app/store/slices/preview-slice";
import { createAppStore } from "@/app/store/store";
import { createExportAttempt, type EditingInstance } from "@/domain/editing-instance";

import { ExportQueueWidget } from "../ExportQueueWidget";

function createSource(id: string, displayName: string): EditingInstance {
  return {
    exportAttempts: [],
    id,
    origin: "source-import",
    snapshot: createDefaultEditorSnapshot(
      { displayName, sourcePath: `C:/Media/${displayName}` },
      false,
    ),
    sourceAvailability: "available",
  };
}

function createAttempt(id: string, source: EditingInstance) {
  return createExportAttempt({
    capturedAt: id === "active-attempt" ? 10 : 20,
    id,
    output: {
      displayName: `${id}.mp4`,
      displayPath: `C:/Exports/${id}.mp4`,
      outputId: `output-${id}`,
    },
    request: {
      audioTracks: [],
      mergeAudio: false,
      rotationDegrees: 0,
      sourcePath: source.snapshot.source.sourcePath,
      trim: { endMicros: 1_000_000, startMicros: 0 },
    },
    route: "fast",
    snapshot: source.snapshot,
  });
}

describe("ExportQueueWidget", () => {
  it("renders active progress and queued item details with thumbnails", () => {
    const activeSource = createSource("active", "active-source.mp4");
    const pendingSource = createSource("pending", "pending-source.mp4");
    const store = createAppStore();

    store.dispatch(editingInstancesAdded([activeSource, pendingSource]));
    store.dispatch(
      editingInstanceExportAttemptQueued({
        id: activeSource.id,
        attempt: createAttempt("active-attempt", activeSource),
      }),
    );
    store.dispatch(
      editingInstanceExportAttemptQueued({
        id: pendingSource.id,
        attempt: createAttempt("pending-attempt", pendingSource),
      }),
    );
    store.dispatch(
      editingInstanceExportStarted({
        attemptId: "active-attempt",
        id: activeSource.id,
        startedAt: 30,
      }),
    );
    store.dispatch(
      editingInstanceExportProgressReceived({
        attemptId: "active-attempt",
        id: activeSource.id,
        metrics: { progressPercent: 42 },
        progress: {
          elapsedMicros: 420_000,
          frame: 42,
          operationId: "operation-1",
          phase: "running",
        },
      }),
    );
    store.dispatch(
      importedThumbnailReady({
        instanceId: activeSource.id,
        thumbnail: { mediaToken: 1, url: "blob:active" },
      }),
    );
    store.dispatch(
      importedThumbnailReady({
        instanceId: pendingSource.id,
        thumbnail: { mediaToken: 2, url: "blob:pending" },
      }),
    );

    render(
      <Provider store={store}>
        <TooltipProvider>
          <ExportQueueWidget layout="vertical" />
        </TooltipProvider>
      </Provider>,
    );

    expect(screen.getByText("active-source.mp4")).toBeInTheDocument();
    expect(screen.getByText("active-attempt.mp4")).toBeInTheDocument();
    expect(screen.getByText("pending-source.mp4")).toBeInTheDocument();
    expect(screen.getByText("pending-attempt.mp4")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Export progress" })).toHaveAttribute(
      "aria-valuenow",
      "42",
    );
    expect(screen.getByRole("button", { name: "Cancel: active-source.mp4" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete: pending-attempt.mp4" })).toBeInTheDocument();
    expect(screen.getByAltText("Active export: active-source.mp4")).toHaveAttribute(
      "src",
      "blob:active",
    );
    expect(screen.getByAltText("Queued export: pending-source.mp4")).toHaveAttribute(
      "src",
      "blob:pending",
    );
  });
});
