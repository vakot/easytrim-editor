import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

const openFileLocation = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tauri/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tauri/media")>()),
  openFileLocation,
}));

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { enqueueExport } from "@/app/store/integration/export-queue-runtime";
import {
  editingInstanceExportAttemptQueued,
  editingInstanceExportCompleted,
  editingInstanceExportStarted,
  editingInstancesAdded,
} from "@/app/store/slices/editing-instances-slice";
import { selectSourceQueueStarted } from "@/app/store/slices/export-slice";
import { preferenceChanged } from "@/app/store/slices/preferences-slice";
import { importedThumbnailLoading } from "@/app/store/slices/preview-slice";
import { createAppStore } from "@/app/store/store";
import { createExportAttempt, type EditingInstance } from "@/domain/editing-instance";
import { firstSource } from "@/test/source.fixtures";

import { SourceList } from "../SourceList";

vi.mock("../components/SourceCard", () => {
  const Container = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return {
    SourceCard: ({ children, source }: PropsWithChildren<{ source: EditingInstance }>) => (
      <div data-testid={source.id}>{children}</div>
    ),
    SourceCardActions: Container,
    SourceCardDescription: () => null,
    SourceCardMetadata: () => null,
    SourceCardStatusBadge: () => null,
    SourceCardThumbnail: Container,
    SourceCardTitle: () => null,
  };
});

describe("source queue controls", () => {
  it("renders file, folder, and drag-and-drop actions when no sources are imported", () => {
    render(
      <Provider store={createAppStore()}>
        <SourceList />
      </Provider>,
    );

    expect(screen.getByRole("form", { name: "Source explorer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open File/ })).toHaveTextContent("CtrlO");
    expect(screen.getByRole("button", { name: /Open Folder/ })).toHaveTextContent("CtrlK");
    expect(screen.getByText("Drag and drop videos here")).toBeInTheDocument();
    expect(screen.getByText("MP4 · MOV · MKV · WebM · AVI")).toBeInTheDocument();
  });

  it("starts and cancels only the chosen source without removing pending attempts", async () => {
    const user = userEvent.setup();
    const store = createAppStore();
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    const snapshot = createDefaultEditorSnapshot(firstSource, false);
    for (const id of ["a", "b"]) {
      store.dispatch(
        editingInstancesAdded([
          {
            id,
            origin: "source-import",
            snapshot,
            sourceAvailability: "available",
            exportAttempts: [],
          },
        ]),
      );
      store.dispatch(importedThumbnailLoading({ instanceId: id }));
      store.dispatch(
        editingInstanceExportAttemptQueued({
          id,
          attempt: createExportAttempt({
            id: `export-${id}`,
            capturedAt: 1,
            snapshot,
            route: "fast",
            request: {
              sourcePath: firstSource.sourcePath,
              trim: { startMicros: 0, endMicros: 1_000_000 },
              audioTracks: [],
              mergeAudio: false,
              rotationDegrees: 0,
            },
            output: { outputId: id, displayName: `${id}.mp4`, displayPath: `C:/Exports/${id}.mp4` },
          }),
        }),
      );
    }
    render(
      <Provider store={store}>
        <SourceList />
      </Provider>,
    );
    const sourceA = within(screen.getByTestId("a").closest("li")!);
    const sourceB = within(screen.getByTestId("b").closest("li")!);
    await user.click(sourceB.getByRole("button", { name: "Start queue" }));
    expect(selectSourceQueueStarted(store.getState(), "b")).toBe(true);
    expect(selectSourceQueueStarted(store.getState(), "a")).toBe(false);
    expect(sourceA.getByRole("button", { name: "Start queue" })).toBeEnabled();
    await user.click(sourceB.getByText("Cancel", { selector: "button" }));
    expect(selectSourceQueueStarted(store.getState(), "b")).toBe(false);
    expect(sourceB.getByRole("button", { name: "Start queue" })).toBeEnabled();
    expect(store.getState().editingInstances.entities.b?.exportAttempts[0]?.state.status).toBe(
      "queued",
    );
  });

  it("cancels an individual queued export", async () => {
    const user = userEvent.setup();
    const store = createAppStore();
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    const snapshot = createDefaultEditorSnapshot(firstSource, false);
    const attempt = createExportAttempt({
      id: "export-first",
      capturedAt: 1,
      snapshot,
      route: "fast",
      request: {
        sourcePath: firstSource.sourcePath,
        trim: { startMicros: 0, endMicros: 1_000_000 },
        audioTracks: [],
        mergeAudio: false,
        rotationDegrees: 0,
      },
      output: { outputId: "first", displayName: "first.mp4", displayPath: "C:/Exports/first.mp4" },
    });

    store.dispatch(
      editingInstancesAdded([
        {
          id: "first",
          origin: "source-import",
          snapshot,
          sourceAvailability: "available",
          exportAttempts: [],
        },
      ]),
    );
    store.dispatch(importedThumbnailLoading({ instanceId: "first" }));
    store.dispatch(editingInstanceExportAttemptQueued({ id: "first", attempt }));
    enqueueExport("first", attempt, store.dispatch, store.getState);

    render(
      <Provider store={store}>
        <SourceList />
      </Provider>,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(store.getState().editingInstances.entities.first?.exportAttempts[0]?.state.status).toBe(
      "canceled",
    );
  });

  it("reveals the output for a completed export", async () => {
    const user = userEvent.setup();
    const store = createAppStore();
    const snapshot = createDefaultEditorSnapshot(firstSource, false);
    const attempt = createExportAttempt({
      id: "export-first",
      capturedAt: 1,
      snapshot,
      route: "fast",
      request: {
        sourcePath: firstSource.sourcePath,
        trim: { startMicros: 0, endMicros: 1_000_000 },
        audioTracks: [],
        mergeAudio: false,
        rotationDegrees: 0,
      },
      output: { outputId: "first", displayName: "first.mp4", displayPath: "C:/Exports/first.mp4" },
    });

    store.dispatch(
      editingInstancesAdded([
        {
          id: "first",
          origin: "source-import",
          snapshot,
          sourceAvailability: "available",
          exportAttempts: [],
        },
      ]),
    );
    store.dispatch(importedThumbnailLoading({ instanceId: "first" }));
    store.dispatch(editingInstanceExportAttemptQueued({ id: "first", attempt }));
    store.dispatch(
      editingInstanceExportStarted({ attemptId: attempt.id, id: "first", startedAt: 2 }),
    );
    store.dispatch(
      editingInstanceExportCompleted({
        attemptId: attempt.id,
        durationMs: 1,
        id: "first",
        result: {
          displayName: "first.mp4",
          displayPath: "C:/Exports/first.mp4",
          operationId: "operation-1",
        },
      }),
    );

    render(
      <Provider store={store}>
        <SourceList />
      </Provider>,
    );

    await user.click(screen.getByRole("button", { name: /Reveal in/ }));
    expect(openFileLocation).toHaveBeenCalledWith("C:/Exports/first.mp4");
  });
});
