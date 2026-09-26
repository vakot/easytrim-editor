import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  editingInstanceExportAttemptQueued,
  editingInstanceExportCanceled,
  editingInstanceExportCompleted,
  editingInstanceExportFailed,
  editingInstanceExportProgressReceived,
  editingInstanceExportStarted,
  editingInstancesAdded,
} from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import { createExportAttempt, type EditingInstance } from "@/domain/editing-instance";
import type { ExportProgress } from "@/domain/media";
import { firstSource } from "@/test/source.fixtures";

type ExportQueueStoryStatus = "canceled" | "completed" | "failed" | "queued" | "rendering";

type ExportQueueStoryItem = {
  capturedAt?: number;
  id: string;
  label?: string;
  progressPercent?: number;
  route?: "fast" | "optimized";
  status: ExportQueueStoryStatus;
};

function createStorySource(): EditingInstance {
  return {
    exportAttempts: [],
    id: "story-source",
    origin: "source-import",
    snapshot: createDefaultEditorSnapshot(
      {
        displayName: "travel-highlights.mp4",
        sourcePath: firstSource.sourcePath,
      },
      false,
    ),
    sourceAvailability: "available",
  };
}

function createStoryStore(items: ExportQueueStoryItem[]) {
  const store = createAppStore();
  const source = createStorySource();

  store.dispatch(editingInstancesAdded([source]));

  for (const [index, item] of items.entries()) {
    const route = item.route ?? "fast";
    const baseRequest = {
      audioTracks: [],
      mergeAudio: false,
      rotationDegrees: 0 as const,
      sourcePath: firstSource.sourcePath,
      trim: { endMicros: 12_000_000, startMicros: 2_000_000 },
    };

    const request =
      route === "optimized"
        ? {
            ...baseRequest,
            arguments: "-c:v libx264 -crf 18",
            resolution: { height: 1080, width: 1920 },
          }
        : baseRequest;

    const attempt = createExportAttempt({
      capturedAt: item.capturedAt ?? index + 1,
      id: item.id,
      output: {
        displayName: `${item.label ?? item.id}.mp4`,
        displayPath: `C:/Exports/${item.label ?? item.id}.mp4`,
        outputId: `output-${item.id}`,
      },
      request,
      route,
      snapshot: source.snapshot,
    });

    store.dispatch(editingInstanceExportAttemptQueued({ attempt, id: source.id }));

    applyStoryStatus(store, source.id, attempt.id, item);
  }

  return store;
}

function applyStoryStatus(
  store: ReturnType<typeof createAppStore>,
  instanceId: string,
  attemptId: string,
  item: ExportQueueStoryItem,
) {
  if (item.status === "queued") return;

  store.dispatch(editingInstanceExportStarted({ attemptId, id: instanceId, startedAt: 2 }));

  const progressPercent = item.progressPercent ?? (item.status === "rendering" ? 64 : 100);
  const operationId = `operation-${attemptId}`;
  const progress: ExportProgress = {
    elapsedMicros: 2_400_000,
    fps: "29.97",
    frame: Math.round(progressPercent * 30),
    operationId,
    phase: "running",
    speed: "1.2x",
    totalSize: 18_000_000,
  };

  store.dispatch(
    editingInstanceExportProgressReceived({
      attemptId,
      id: instanceId,
      metrics: {
        durationMs: 2_400,
        fileSizeBytes: 18_000_000,
        fps: 29.97,
        progressPercent,
      },
      progress,
    }),
  );

  if (item.status === "rendering") return;

  if (item.status === "completed") {
    store.dispatch(
      editingInstanceExportCompleted({
        attemptId,
        durationMs: 3_100,
        id: instanceId,
        result: {
          displayName: `${item.label ?? item.id}.mp4`,
          displayPath: `C:/Exports/${item.label ?? item.id}.mp4`,
          operationId,
        },
      }),
    );
    return;
  }

  if (item.status === "failed") {
    store.dispatch(
      editingInstanceExportFailed({
        attemptId,
        durationMs: 1_800,
        error: { code: "render-failed", message: "The source could not be rendered." },
        id: instanceId,
      }),
    );
    return;
  }

  store.dispatch(editingInstanceExportCanceled({ attemptId, durationMs: 900, id: instanceId }));
}

export type { ExportQueueStoryItem, ExportQueueStoryStatus };
export { createStoryStore };
