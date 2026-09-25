import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  editingInstanceExportAttemptQueued,
  editingInstanceExportProgressReceived,
  editingInstanceExportStarted,
  editingInstancesAdded,
  editingInstancesClosed,
} from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import { createExportAttempt, type EditingInstance } from "@/domain/editing-instance";
import { firstSource } from "@/test/source.fixtures";

import { RenderQueue } from "../RenderQueue";

function createSource(): EditingInstance {
  const snapshot = createDefaultEditorSnapshot(firstSource, false);
  return {
    exportAttempts: [],
    id: "source-1",
    origin: "source-import",
    snapshot,
    sourceAvailability: "available",
  };
}

function addAttempt(store: ReturnType<typeof createAppStore>) {
  const source = createSource();
  const attempt = createExportAttempt({
    capturedAt: 1,
    id: "attempt-1",
    output: {
      displayName: "trimmed.mp4",
      displayPath: "C:/Exports/trimmed.mp4",
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
    snapshot: source.snapshot,
  });

  store.dispatch(editingInstancesAdded([source]));
  store.dispatch(editingInstanceExportAttemptQueued({ attempt, id: source.id }));
  return { attempt, source };
}

describe("RenderQueue", () => {
  it("keeps a queued attempt visible after its source is closed", () => {
    const store = createAppStore();
    const { source } = addAttempt(store);
    store.dispatch(editingInstancesClosed([source.id]));

    render(
      <Provider store={store}>
        <RenderQueue />
      </Provider>,
    );

    expect(screen.getByText("trimmed.mp4")).toBeInTheDocument();
    expect(screen.getByText("Queued")).toBeInTheDocument();
  });

  it("shows rendering progress from the existing export attempt metrics", () => {
    const store = createAppStore();
    const { attempt, source } = addAttempt(store);
    store.dispatch(
      editingInstanceExportStarted({ attemptId: attempt.id, id: source.id, startedAt: 2 }),
    );
    store.dispatch(
      editingInstanceExportProgressReceived({
        attemptId: attempt.id,
        id: source.id,
        metrics: { progressPercent: 42 },
        progress: {
          elapsedMicros: 420_000,
          operationId: "operation-1",
          phase: "running",
        },
      }),
    );

    render(
      <Provider store={store}>
        <RenderQueue />
      </Provider>,
    );

    expect(screen.getByText("Rendering…")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel export" })).toBeInTheDocument();
  });
});
