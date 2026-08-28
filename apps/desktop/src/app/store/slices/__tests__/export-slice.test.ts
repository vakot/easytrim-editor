import { describe, expect, it } from "vitest";

import { sourceSelected } from "@/app/store/actions/source-actions";
import type { RootState } from "@/app/store/store";
import { cropChanged } from "../crop-slice";
import {
  exportCanceled,
  exportCompleted,
  exportFailed,
  exportProgressReceived,
  exportReducer,
  exportStarted,
  finishedExportsCleared,
  importQueueItemAdded,
  importQueueItemRemoved,
  initialExportState,
  optimizedExportDialogClosed,
  optimizedExportDialogOpened,
  optimizedExportPlanFailed,
  optimizedExportPlanReceived,
  optimizedExportPlanRequested,
  optimizedExportSettingsChanged,
  queueEntryAdded,
  queueFinishActionChanged,
  queueStarted,
  selectExportQueue,
} from "../export-slice";

const settings = { resolution: { width: 1920, height: 1080 }, frameRate: undefined };
const item = {
  id: "export-1",
  snapshot: {
    source: { displayName: "first.mp4", sourcePath: "C:/Media/first.mp4" },
    trim: { startMicros: 0, endMicros: 1_000_000 },
    crop: null,
    audio: { master: { enabled: true, volumePercent: 50 }, tracks: [], mergeAudio: false },
  },
  route: "optimized" as const,
  request: {
    sourcePath: "C:/Media/first.mp4",
    trim: { startMicros: 0, endMicros: 1_000_000 },
    audioTracks: [],
    mergeAudio: false,
    resolution: settings.resolution,
    arguments: "-c:v hevc_nvenc",
  },
  outputId: "output-1",
  filename: "clip.mp4",
  path: "C:/Exports/clip.mp4",
  status: "queued" as const,
  operationId: null,
  startedAt: null,
  durationMs: null,
  progressPercent: 0,
};

describe("export slice", () => {
  it("starts from runtime-only defaults", () => {
    expect(initialExportState).toMatchObject({
      queue: [],
      queueStarted: false,
      optimizedDialogOpen: false,
      availableQueueFinishActions: ["exit", "nothing"],
    });
  });

  it("owns dialog open/close and active settings", () => {
    const opened = exportReducer(initialExportState, optimizedExportDialogOpened(settings));
    expect(opened.optimizedDialogOpen).toBe(true);
    expect(opened.optimizedSettings).toEqual(settings);
    expect(exportReducer(opened, optimizedExportDialogClosed()).optimizedDialogOpen).toBe(false);
    expect(
      exportReducer(
        opened,
        optimizedExportSettingsChanged({
          ...settings,
          frameRate: { numerator: 30, denominator: 1 },
        }),
      ).optimizedSettings?.frameRate,
    ).toEqual({ numerator: 30, denominator: 1 });
  });

  it("tracks queue lifecycle, progress, failure, cancellation, and clearing", () => {
    let state = exportReducer(initialExportState, queueEntryAdded(item));
    state = exportReducer(state, queueStarted());
    state = exportReducer(state, exportStarted({ id: item.id, startedAt: 1000 }));
    expect(state.queue[0]?.status).toBe("rendering");

    state = exportReducer(
      state,
      exportProgressReceived({
        id: item.id,
        progress: { operationId: "operation-1", elapsedMicros: 500_000, phase: "running" },
        durationMs: 500,
        progressPercent: 50,
      }),
    );
    expect(selectExportQueue({ export: state } as RootState)[0]?.progressPercent).toBe(50);
    state = exportReducer(
      state,
      exportFailed({
        id: item.id,
        error: { code: "io_failed", message: "render failed" },
        durationMs: 700,
      }),
    );
    expect(state.queue[0]?.status).toBe("failed");

    const completed = { ...item, id: "export-2" };
    state = exportReducer(state, queueEntryAdded(completed));
    state = exportReducer(state, exportStarted({ id: completed.id, startedAt: 2000 }));
    state = exportReducer(
      state,
      exportCompleted({
        id: completed.id,
        result: {
          operationId: "operation-2",
          displayName: "clip.mp4",
          displayPath: completed.path,
        },
        durationMs: 800,
      }),
    );
    const canceled = { ...item, id: "export-3" };
    state = exportReducer(state, queueEntryAdded(canceled));
    state = exportReducer(state, exportCanceled({ id: canceled.id, durationMs: null }));
    expect(state.queue.map((entry) => entry.status)).toEqual(["failed", "completed", "canceled"]);
    state = exportReducer(state, finishedExportsCleared());
    expect(state.queue).toEqual([]);
  });

  it("keeps the selected queue finish policy serializable", () => {
    expect(
      exportReducer(initialExportState, queueFinishActionChanged("systemSleep")),
    ).toMatchObject({ queueFinishAction: "systemSleep" });
  });

  it("removes an imported item and clears its active identity", () => {
    const imported = {
      id: "import-1",
      status: "imported" as const,
      origin: "history-fork" as const,
      snapshot: item.snapshot,
    };
    let state = exportReducer(initialExportState, importQueueItemAdded(imported));
    state = exportReducer(state, importQueueItemRemoved(imported.id));
    expect(state.queue).toEqual([]);
    expect(state.activeItemId).toBeNull();
  });

  it("accepts only the latest optimized plan request result", () => {
    let state = exportReducer(initialExportState, optimizedExportPlanRequested({ requestId: 1 }));
    state = exportReducer(state, optimizedExportPlanRequested({ requestId: 2 }));
    state = exportReducer(
      state,
      optimizedExportPlanReceived({ requestId: 2, commandPreview: "new plan" }),
    );
    state = exportReducer(
      state,
      optimizedExportPlanReceived({ requestId: 1, commandPreview: "stale plan" }),
    );
    expect(state.commandPreview).toBe("new plan");

    state = exportReducer(
      state,
      optimizedExportPlanFailed({
        requestId: 1,
        error: { code: "internal", message: "stale failure" },
      }),
    );
    expect(state.commandPreviewError).toBeNull();

    state = exportReducer(
      state,
      optimizedExportPlanFailed({
        requestId: 2,
        error: { code: "internal", message: "latest failure" },
      }),
    );
    expect(state.commandPreviewError?.message).toBe("latest failure");

    state = exportReducer(state, optimizedExportPlanRequested({ requestId: 3 }));
    state = exportReducer(
      state,
      optimizedExportPlanReceived({ requestId: 3, commandPreview: "latest plan" }),
    );
    expect(state.commandPreview).toBe("latest plan");
  });

  it("keeps optimized resolution synchronized with crop changes while closed", () => {
    let state = exportReducer(initialExportState, optimizedExportDialogOpened(settings));
    state = exportReducer(state, optimizedExportDialogClosed());
    state = exportReducer(
      state,
      cropChanged({
        crop: { x: 0.1, y: 0, width: 0.8, height: 1 },
        resolution: { width: 1536, height: 1080 },
      }),
    );
    state = exportReducer(state, optimizedExportDialogOpened(settings));

    expect(state.optimizedSettings?.resolution).toEqual({ width: 1536, height: 1080 });

    state = exportReducer(
      state,
      optimizedExportSettingsChanged({
        ...settings,
        resolution: { width: 1280, height: 720 },
      }),
    );
    expect(state.optimizedSettings?.resolution).toEqual({ width: 1280, height: 720 });

    state = exportReducer(
      state,
      sourceSelected({
        source: {
          displayName: "replacement.mp4",
          sourcePath: "C:/Media/replacement.mp4",
        },
      }),
    );
    expect(state.optimizedDialogOpen).toBe(false);
    expect(state.optimizedSettings).toBeNull();
  });
});
