import { describe, expect, it } from "vitest";

import {
  exportCanceled,
  exportCompleted,
  exportFailed,
  exportProgressReceived,
  exportReducer,
  exportStarted,
  finishedExportsCleared,
  initialExportState,
  optimizedExportDialogClosed,
  optimizedExportDialogOpened,
  optimizedExportSettingsChanged,
  queueEntryAdded,
  queueFinishActionChanged,
  queueStarted,
} from "../export-slice";

const settings = { resolution: { width: 1920, height: 1080 }, frameRate: undefined };
const item = {
  id: "export-1",
  route: "optimized" as const,
  request: {
    sourceId: "source-1",
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
      exportReducer(opened, optimizedExportSettingsChanged({ ...settings, frameRate: { numerator: 30, denominator: 1 } }))
        .optimizedSettings?.frameRate,
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
        progressPercent: 50,
      }),
    );
    expect(state.queue[0]?.progressPercent).toBe(50);
    state = exportReducer(
      state,
      exportFailed({ id: item.id, error: { code: "io_failed", message: "render failed" } }),
    );
    expect(state.queue[0]?.status).toBe("failed");

    const completed = { ...item, id: "export-2" };
    state = exportReducer(state, queueEntryAdded(completed));
    state = exportReducer(state, exportStarted({ id: completed.id, startedAt: 2000 }));
    state = exportReducer(
      state,
      exportCompleted({
        id: completed.id,
        result: { operationId: "operation-2", displayName: "clip.mp4", displayPath: completed.path },
      }),
    );
    const canceled = { ...item, id: "export-3" };
    state = exportReducer(state, queueEntryAdded(canceled));
    state = exportReducer(state, exportCanceled({ id: canceled.id }));
    expect(state.queue.map((entry) => entry.status)).toEqual(["failed", "completed", "canceled"]);
    state = exportReducer(state, finishedExportsCleared());
    expect(state.queue).toEqual([]);
  });

  it("keeps the selected queue finish policy serializable", () => {
    expect(exportReducer(initialExportState, queueFinishActionChanged("systemSleep")))
      .toMatchObject({ queueFinishAction: "systemSleep" });
  });
});
