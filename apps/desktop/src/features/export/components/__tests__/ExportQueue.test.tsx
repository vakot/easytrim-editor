import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  editingInstanceExportAttemptQueued,
  editingInstanceExportCanceled,
  editingInstanceExportCompleted,
  editingInstanceExportFailed,
  editingInstanceExportProgressReceived,
  editingInstanceExportStarted,
  editingInstancesAdded,
  editingInstancesClosed,
} from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import { createExportAttempt, type EditingInstance } from "@/domain/editing-instance";
import { firstSource } from "@/test/source.fixtures";

import {
  ExportQueue,
  ExportQueueActions,
  ExportQueueContent,
  ExportQueueSummary,
} from "../ExportQueue";

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

function addAttempt(
  store: ReturnType<typeof createAppStore>,
  { capturedAt = 1, id = "attempt-1" }: { capturedAt?: number; id?: string } = {},
) {
  const source = createSource();
  const attempt = createExportAttempt({
    capturedAt,
    id,
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

  if (!store.getState().editingInstances.entities[source.id]) {
    store.dispatch(editingInstancesAdded([source]));
  }
  store.dispatch(editingInstanceExportAttemptQueued({ attempt, id: source.id }));
  return { attempt, source };
}

function completeAttempt(
  store: ReturnType<typeof createAppStore>,
  attemptId: string,
  instanceId: string,
) {
  store.dispatch(editingInstanceExportStarted({ attemptId, id: instanceId, startedAt: 2 }));
  store.dispatch(
    editingInstanceExportCompleted({
      attemptId,
      durationMs: 1_200,
      id: instanceId,
      result: {
        displayName: "trimmed.mp4",
        displayPath: "C:/Exports/trimmed.mp4",
        operationId: "operation-1",
      },
    }),
  );
}

describe("ExportQueue", () => {
  it("shows an empty state when there are no export attempts", () => {
    const store = createAppStore();

    render(
      <Provider store={store}>
        <ExportQueue>
          <ExportQueueContent />
        </ExportQueue>
      </Provider>,
    );

    expect(screen.getByRole("heading", { name: "Queue" })).toBeInTheDocument();
    expect(screen.getByText("Export attempts will appear here.")).toBeInTheDocument();
  });

  it("keeps a queued attempt visible after its source is closed", () => {
    const store = createAppStore();
    const { source } = addAttempt(store);
    store.dispatch(editingInstancesClosed([source.id]));

    render(
      <Provider store={store}>
        <ExportQueue>
          <ExportQueueContent />
        </ExportQueue>
      </Provider>,
    );

    expect(screen.getByText("trimmed.mp4")).toBeInTheDocument();
    expect(screen.getByText("Queued")).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
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
        <ExportQueue>
          <ExportQueueContent />
        </ExportQueue>
      </Provider>,
    );

    expect(screen.getByText("Rendering…")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel export" })).toBeInTheDocument();
  });

  it("summarizes all live statuses and renders semantic badge variants", () => {
    const store = createAppStore();
    addAttempt(store, { capturedAt: 1, id: "queued" });
    const rendering = addAttempt(store, { capturedAt: 2, id: "rendering" });
    const completed = addAttempt(store, { capturedAt: 3, id: "completed" });
    const failed = addAttempt(store, { capturedAt: 4, id: "failed" });
    const canceled = addAttempt(store, { capturedAt: 5, id: "canceled" });

    store.dispatch(
      editingInstanceExportStarted({
        attemptId: rendering.attempt.id,
        id: rendering.source.id,
        startedAt: 2,
      }),
    );
    completeAttempt(store, completed.attempt.id, completed.source.id);
    store.dispatch(
      editingInstanceExportStarted({
        attemptId: failed.attempt.id,
        id: failed.source.id,
        startedAt: 2,
      }),
    );
    store.dispatch(
      editingInstanceExportFailed({
        attemptId: failed.attempt.id,
        durationMs: 500,
        error: { code: "failed", message: "Render failed" },
        id: failed.source.id,
      }),
    );
    store.dispatch(
      editingInstanceExportCanceled({
        attemptId: canceled.attempt.id,
        durationMs: 250,
        id: canceled.source.id,
      }),
    );

    render(
      <Provider store={store}>
        <ExportQueue>
          <ExportQueueSummary />
          <ExportQueueActions />
          <ExportQueueContent />
        </ExportQueue>
      </Provider>,
    );

    expect(
      screen.getByText("5 jobs · 1 rendering · 1 queued · 1 failed · 1 canceled · 1 completed"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start queue" })).not.toBeDisabled();
    expect(screen.getByText("Rendering…")).toHaveAttribute("data-variant", "default");
    expect(screen.getByText("Completed")).toHaveAttribute("data-variant", "success");
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toHaveAttribute("data-variant", "destructive");
    expect(screen.getByText("Canceled")).toHaveAttribute("data-variant", "secondary");
    expect(screen.getByText("Queued")).toHaveAttribute("data-variant", "outline");
    expect(screen.getAllByRole("button", { name: "Restore edit" })).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Reveal output" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Export error: Render failed" })).toBeInTheDocument();
  });

  it("disables Start queue when only terminal jobs remain", () => {
    const store = createAppStore();
    const { attempt, source } = addAttempt(store);
    completeAttempt(store, attempt.id, source.id);

    render(
      <Provider store={store}>
        <ExportQueue>
          <ExportQueueSummary />
          <ExportQueueActions />
        </ExportQueue>
      </Provider>,
    );

    expect(screen.getByText("1 job · 1 completed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start queue" })).toBeDisabled();
  });
});
