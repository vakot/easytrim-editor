import {
  exportCanceled,
  exportCompleted,
  exportFailed,
  exportProgressReceived,
  type ExportQueueItem,
  exportStarted,
} from "@/app/store/slices/export-slice";
import type { AppDispatch, RootState } from "@/app/store/store";
import {
  estimateExportSize,
  estimateExportTime,
  parseFfmpegBitrate,
  parseFfmpegNumber,
} from "@/domain/export-metrics";
import {
  cancelOperation,
  deleteSourceFile,
  releaseExportSource,
  renderFast,
  renderOptimized,
} from "@/lib/tauri/media";
import type { ExportProgress } from "@/lib/tauri/media.types";
import { normalizeAppError } from "@/lib/tauri/media.utils";
import { performQueueFinishAction } from "@/lib/tauri/queue";

interface RuntimeExportJob {
  canceled: boolean;
  dispatch: AppDispatch;
  getState: () => RootState;
  item: ExportQueueItem;
  operationId: string | null;
  startedAt: number | null;
}

interface RuntimeState {
  executionEnabled: boolean;
  isDraining: boolean;
  jobsById: Map<string, RuntimeExportJob>;
  pendingJobs: RuntimeExportJob[];
  queueHadWork: boolean;
  suppressQueueFinishAction: boolean;
}

const runtimeByStore = new WeakMap<() => RootState, RuntimeState>();

function runtimeFor(getState: () => RootState): RuntimeState {
  const existing = runtimeByStore.get(getState);
  if (existing) return existing;
  const runtime: RuntimeState = {
    executionEnabled: false,
    isDraining: false,
    jobsById: new Map(),
    pendingJobs: [],
    queueHadWork: false,
    suppressQueueFinishAction: false,
  };

  runtimeByStore.set(getState, runtime);
  return runtime;
}

export function setExportQueueExecutionEnabled(
  enabled: boolean,
  dispatch: AppDispatch,
  getState: () => RootState,
) {
  const runtime = runtimeFor(getState);
  runtime.executionEnabled = enabled;
  if (enabled) void drainQueue(runtime, dispatch, getState);
}

export function enqueueExport(
  item: ExportQueueItem,
  dispatch: AppDispatch,
  getState: () => RootState,
) {
  const runtime = runtimeFor(getState);
  const job: RuntimeExportJob = {
    item,
    canceled: false,
    operationId: null,
    startedAt: null,
    dispatch,
    getState,
  };

  runtime.pendingJobs.push(job);
  runtime.jobsById.set(item.id, job);
  runtime.queueHadWork = true;
  void drainQueue(runtime, dispatch, getState);
}

export function cancelQueuedExport(id: string, getState: () => RootState) {
  const runtime = runtimeFor(getState);
  const job = runtime.jobsById.get(id);
  if (!job || job.canceled) return;

  job.canceled = true;
  job.dispatch(exportCanceled({ id, durationMs: elapsedTime(job) }));
  if (job.startedAt === null) {
    removePendingJob(runtime, job);
  }
  if (job.operationId) {
    void cancelOperation(job.operationId).catch(() => undefined);
  } else {
    void releaseExportSource(job.item.request.sourcePath).catch(() => undefined);
  }
  void drainQueue(runtime, job.dispatch, job.getState);
}

function removePendingJob(runtime: RuntimeState, job: RuntimeExportJob) {
  const pendingIndex = runtime.pendingJobs.indexOf(job);
  if (pendingIndex >= 0) runtime.pendingJobs.splice(pendingIndex, 1);
  runtime.jobsById.delete(job.item.id);
}

export function cancelActiveExport(getState: () => RootState) {
  const runtime = runtimeFor(getState);
  const activeJob = [...runtime.jobsById.values()].find((job) => job.startedAt !== null);
  if (activeJob) cancelQueuedExport(activeJob.item.id, getState);
}

export function cancelAllQueuedExports(getState: () => RootState) {
  const runtime = runtimeFor(getState);
  runtime.suppressQueueFinishAction = true;
  [...runtime.jobsById.keys()].forEach((id) => cancelQueuedExport(id, getState));
}

async function drainQueue(runtime: RuntimeState, dispatch: AppDispatch, getState: () => RootState) {
  if (runtime.isDraining || !runtime.executionEnabled) return;
  runtime.isDraining = true;

  try {
    while (runtime.executionEnabled && runtime.pendingJobs.length > 0) {
      const job = runtime.pendingJobs.shift();
      if (!job) continue;
      if (job.canceled) {
        runtime.jobsById.delete(job.item.id);
        continue;
      }

      job.startedAt = Date.now();
      dispatch(exportStarted({ id: job.item.id, startedAt: job.startedAt }));
      await renderJob(job);
    }
  } finally {
    runtime.isDraining = false;
    maybePerformQueueFinishAction(runtime, dispatch, getState);
    if (runtime.executionEnabled && runtime.pendingJobs.length > 0) {
      void drainQueue(runtime, dispatch, getState);
    }
  }
}

async function renderJob(job: RuntimeExportJob) {
  const onProgress = (progress: ExportProgress) => {
    if (job.canceled) {
      void cancelOperation(progress.operationId).catch(() => undefined);
      return;
    }

    job.operationId = progress.operationId;
    const durationMicros = job.item.request.trim.endMicros - job.item.request.trim.startMicros;
    const progressPercent =
      durationMicros > 0
        ? Math.min(100, Math.max(0, (progress.elapsedMicros / durationMicros) * 100))
        : 0;

    const estimatedTime = estimateExportTime(
      progress.elapsedMicros,
      durationMicros,
      progress.speed,
    );

    const estimatedSize = estimateExportSize(
      progress.totalSize,
      progress.bitrate,
      progress.elapsedMicros,
      durationMicros,
    );

    job.dispatch(
      exportProgressReceived({
        id: job.item.id,
        progress,
        durationMs: elapsedTime(job),
        progressPercent,
        fps: parseFfmpegNumber(progress.fps) ?? undefined,
        bitrate: parseFfmpegBitrate(progress.bitrate) === null ? undefined : progress.bitrate,
        estimatedFileSizeBytes: estimatedSize?.totalBytes,
        estimatedElapsedTimeMs: estimatedTime?.elapsedMs,
        estimatedTotalTimeMs: estimatedTime?.totalMs,
      }),
    );
  };

  try {
    const result =
      job.item.route === "fast"
        ? await renderFast(job.item.request, job.item.outputId, onProgress)
        : await renderOptimized(
            job.item.request as import("@/lib/tauri/media.types").OptimizedExportRequest,
            job.item.outputId,
            onProgress,
          );

    if (!job.canceled) {
      job.dispatch(exportCompleted({ id: job.item.id, result, durationMs: elapsedTime(job) }));
      if (job.getState().export.deleteSourceOnRenderFinish) {
        await deleteSourceFile(job.item.request.sourcePath).catch(() => undefined);
      }
    }
  } catch (error: unknown) {
    if (!job.canceled) {
      job.dispatch(
        exportFailed({
          id: job.item.id,
          error: normalizeAppError(error),
          durationMs: elapsedTime(job),
        }),
      );
    }
  } finally {
    runtimeFor(job.getState).jobsById.delete(job.item.id);
  }
}

function elapsedTime(job: RuntimeExportJob) {
  return job.startedAt ? Date.now() - job.startedAt : null;
}

function maybePerformQueueFinishAction(
  runtime: RuntimeState,
  dispatch: AppDispatch,
  getState: () => RootState,
) {
  if (
    runtime.isDraining ||
    runtime.pendingJobs.length > 0 ||
    runtime.jobsById.size > 0 ||
    !runtime.queueHadWork
  ) {
    return;
  }
  runtime.queueHadWork = false;
  if (runtime.suppressQueueFinishAction) {
    runtime.suppressQueueFinishAction = false;
    return;
  }
  const hasTerminalWork = getState().export.queue.some(
    (item) => item.status === "completed" || item.status === "failed",
  );

  if (!hasTerminalWork) return;
  const action = getState().export.queueFinishAction;
  if (action !== "nothing") void performQueueFinishAction(action).catch(() => undefined);
  void dispatch;
}
