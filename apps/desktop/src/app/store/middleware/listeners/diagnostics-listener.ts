import { importQueueItemActivated } from "@/app/store/actions/imported-queue-actions";
import {
  sourceCleared,
  sourceFailed,
  sourceReady,
  sourceSelected,
} from "@/app/store/actions/source-actions";
import {
  audioMergeToggled,
  audioPreviewsLoading,
  audioPreviewsReady,
  audioPreviewsUnavailable,
  audioTrackToggled,
  audioTrackVolumeChanged,
  masterAudioToggled,
  masterVolumeChanged,
  waveformDisplayFailed,
  waveformReady,
  waveformsFailed,
  waveformsLoading,
} from "@/app/store/slices/audio-slice";
import { cropChanged } from "@/app/store/slices/crop-slice";
import {
  activeQueueItemChanged,
  exportCanceled,
  exportCompleted,
  exportFailed,
  exportLaunchFailed,
  exportProgressReceived,
  exportStarted,
  optimizedExportDialogClosed,
  optimizedExportDialogOpened,
  optimizedExportPlanFailed,
  optimizedExportPlanReceived,
  optimizedExportPlanRequested,
  queueItemPromoted,
  queuePaused,
  queueStarted,
} from "@/app/store/slices/export-slice";
import { previewFailed, previewLoading, previewReady } from "@/app/store/slices/preview-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import { diagnostics } from "@/lib/diagnostics";

import { listenerMiddleware } from "../listener-middleware";

const internalOrigin = { type: "internal" as const };

listenerMiddleware.startListening({
  actionCreator: sourceSelected,
  effect: (action) => {
    diagnostics.event("source.state.changed", {
      data: {
        displayName: action.payload.source.displayName,
        loadToken: action.payload.loadToken ?? 0,
        status: "loading-source",
      },
      origin: internalOrigin,
    });
  },
});
listenerMiddleware.startListening({
  actionCreator: importQueueItemActivated,
  effect: (action) =>
    diagnostics.event("snapshot.active.changed", {
      data: { itemId: action.payload.id, status: "loading" },
      origin: internalOrigin,
      snapshotId: action.payload.id,
    }),
});
listenerMiddleware.startListening({
  actionCreator: sourceReady,
  effect: (action) =>
    diagnostics.event("source.state.changed", {
      data: {
        audioStreamCount: action.payload.media.audioStreams.length,
        durationMicros: action.payload.media.durationMicros,
        status: "ready",
      },
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: sourceFailed,
  effect: (action) =>
    diagnostics.error("source.state.failed", action.payload.error, {
      data: { code: action.payload.error.code, status: "failed" },
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: sourceCleared,
  effect: () =>
    diagnostics.event("source.state.changed", { data: { status: "idle" }, origin: internalOrigin }),
});

listenerMiddleware.startListening({
  actionCreator: previewLoading,
  effect: (action) =>
    diagnostics.event("preview.state.changed", {
      data: { kind: action.payload.kind, status: "loading" },
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: previewReady,
  effect: (action) =>
    diagnostics.event("preview.state.changed", {
      data: { kind: action.payload.preview.kind, status: "ready" },
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: previewFailed,
  effect: (action) =>
    diagnostics.error("preview.state.failed", action.payload.error, {
      data: { status: "failed" },
      origin: internalOrigin,
    }),
});

listenerMiddleware.startListening({
  actionCreator: trimChanged,
  effect: (action) =>
    diagnostics.event("timeline.trim.changed", {
      data: {
        endMicros: action.payload.trim.endMicros,
        startMicros: action.payload.trim.startMicros,
      },
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: cropChanged,
  effect: (action) =>
    diagnostics.event("crop.state.changed", {
      data: {
        height: action.payload.crop.height,
        width: action.payload.crop.width,
        x: action.payload.crop.x,
        y: action.payload.crop.y,
      },
      origin: internalOrigin,
    }),
});

listenerMiddleware.startListening({
  actionCreator: audioPreviewsLoading,
  effect: () =>
    diagnostics.event("audio.preview.state.changed", {
      data: { status: "loading" },
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: audioPreviewsReady,
  effect: (action) =>
    diagnostics.event("audio.preview.state.changed", {
      data: { previewCount: action.payload.previews.length, status: "ready" },
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: audioPreviewsUnavailable,
  effect: (action) =>
    diagnostics.error("audio.preview.state.failed", action.payload.error, {
      data: { status: "unavailable" },
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: audioTrackToggled,
  effect: (action) =>
    diagnostics.event("audio.track.changed", {
      data: { streamIndex: action.payload.streamIndex },
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: audioTrackVolumeChanged,
  effect: (action) =>
    diagnostics.event("audio.track.changed", {
      data: {
        streamIndex: action.payload.streamIndex,
        volumePercent: action.payload.volumePercent,
      },
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: masterAudioToggled,
  effect: () => diagnostics.event("audio.master.changed", { origin: internalOrigin }),
});
listenerMiddleware.startListening({
  actionCreator: masterVolumeChanged,
  effect: (action) =>
    diagnostics.event("audio.master.changed", {
      data: { volumePercent: action.payload.volumePercent },
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: audioMergeToggled,
  effect: () => diagnostics.event("audio.mix.changed", { origin: internalOrigin }),
});

listenerMiddleware.startListening({
  actionCreator: waveformsLoading,
  effect: (action) =>
    diagnostics.event("waveform.state.changed", {
      data: {
        jobId: action.payload.jobId,
        status: "loading",
        streamCount: action.payload.streamIndexes.length,
        width: action.payload.width,
      },
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: waveformReady,
  effect: (action) =>
    diagnostics.event("waveform.state.changed", {
      data: {
        status: "ready",
        streamIndex: action.payload.streamIndex,
        width: action.payload.width,
      },
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: waveformDisplayFailed,
  effect: (action) =>
    diagnostics.event("waveform.state.changed", {
      data: { status: "failed", streamIndex: action.payload.streamIndex },
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: waveformsFailed,
  effect: (action) =>
    diagnostics.error("waveform.state.failed", action.payload.error, {
      data: {
        jobId: action.payload.jobId,
        status: "failed",
        streamCount: action.payload.streamIndexes.length,
        width: action.payload.width,
      },
      origin: internalOrigin,
    }),
});

listenerMiddleware.startListening({
  actionCreator: activeQueueItemChanged,
  effect: (action) =>
    diagnostics.event("export.active.changed", {
      data: { itemId: action.payload ?? "none" },
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: queueStarted,
  effect: () =>
    diagnostics.event("export.queue.state.changed", {
      data: { status: "running" },
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: queuePaused,
  effect: () =>
    diagnostics.event("export.queue.state.changed", {
      data: { status: "paused" },
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: queueItemPromoted,
  effect: (action) =>
    diagnostics.event("export.queue.item.changed", {
      data: { itemId: action.payload.id, route: action.payload.route, status: "queued" },
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: exportStarted,
  effect: (action) =>
    diagnostics.event("export.state.changed", {
      data: { itemId: action.payload.id, status: "rendering" },
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: exportProgressReceived,
  effect: (action) =>
    diagnostics.event("export.progress.reported", {
      data: { itemId: action.payload.id, percent: action.payload.progressPercent },
      operationId: action.payload.progress.operationId,
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: exportCompleted,
  effect: (action) =>
    diagnostics.event("export.state.changed", {
      data: { itemId: action.payload.id, status: "completed" },
      operationId: action.payload.result.operationId,
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: exportFailed,
  effect: (action) =>
    diagnostics.error("export.state.failed", action.payload.error, {
      data: { itemId: action.payload.id, status: "failed" },
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: exportCanceled,
  effect: (action) =>
    diagnostics.event("export.state.changed", {
      data: { itemId: action.payload.id, status: "cancelled" },
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: exportLaunchFailed,
  effect: (action) =>
    diagnostics.error("export.launch.failed", action.payload, { origin: internalOrigin }),
});
listenerMiddleware.startListening({
  actionCreator: optimizedExportDialogOpened,
  effect: () => diagnostics.event("export.dialog.opened", { origin: internalOrigin }),
});
listenerMiddleware.startListening({
  actionCreator: optimizedExportDialogClosed,
  effect: () => diagnostics.event("export.dialog.closed", { origin: internalOrigin }),
});
listenerMiddleware.startListening({
  actionCreator: optimizedExportPlanRequested,
  effect: (action) =>
    diagnostics.event("export.plan.requested", {
      data: { requestId: action.payload.requestId },
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: optimizedExportPlanReceived,
  effect: (action) =>
    diagnostics.event("export.plan.ready", {
      data: { requestId: action.payload.requestId },
      origin: internalOrigin,
    }),
});
listenerMiddleware.startListening({
  actionCreator: optimizedExportPlanFailed,
  effect: (action) =>
    diagnostics.error("export.plan.failed", action.payload.error, {
      data: { requestId: action.payload.requestId },
      origin: internalOrigin,
    }),
});
