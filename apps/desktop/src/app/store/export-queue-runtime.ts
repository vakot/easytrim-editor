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
  type ExportProgress,
  normalizeAppError,
  releaseExportSource,
  renderFast,
  renderOptimized,
} from "@/lib/tauri/media";
import { performQueueFinishAction } from "@/lib/tauri/queue";

interface RuntimeExportJob {
  item: ExportQueueItem;
  canceled: boolean;
  operationId: string | null;
  startedAt: number | null;
  dispatch: AppDispatch;
  getState: () => RootState;
}

const pendingJobs: RuntimeExportJob[] = [];
const jobsById = new Map<string, RuntimeExportJob>();
let isDraining = false;
let executionEnabled = false;
let queueHadWork = false;
let suppressQueueFinishAction = false;

export function setExportQueueExecutionEnabled(
  enabled: boolean,
  dispatch: AppDispatch,
  getState: () => RootState,
) {
  executionEnabled = enabled;
  if (enabled) void drainQueue(dispatch, getState);
}

export function enqueueExport(
  item: ExportQueueItem,
  dispatch: AppDispatch,
  getState: () => RootState,
) {
  const job: RuntimeExportJob = {
    item,
    canceled: false,
    operationId: null,
    startedAt: null,
    dispatch,
    getState,
  };
  pendingJobs.push(job);
  jobsById.set(item.id, job);
  queueHadWork = true;
  void drainQueue(dispatch, getState);
}

export function cancelQueuedExport(id: string) {
  const job = jobsById.get(id);
  if (!job || job.canceled) return;

  job.canceled = true;
  job.dispatch(exportCanceled({ id, durationMs: elapsedTime(job) }));
  if (job.startedAt === null) {
    removePendingJob(job);
  }
  if (job.operationId) {
    void cancelOperation(job.operationId).catch(() => undefined);
  } else {
    void releaseExportSource(job.item.request.sourcePath).catch(() => undefined);
  }
  void drainQueue(job.dispatch, job.getState);
}

function removePendingJob(job: RuntimeExportJob) {
  const pendingIndex = pendingJobs.indexOf(job);
  if (pendingIndex >= 0) pendingJobs.splice(pendingIndex, 1);
  jobsById.delete(job.item.id);
}

export function cancelActiveExport() {
  const activeJob = [...jobsById.values()].find((job) => job.startedAt !== null);
  if (activeJob) cancelQueuedExport(activeJob.item.id);
}

export function cancelAllQueuedExports() {
  suppressQueueFinishAction = true;
  [...jobsById.keys()].forEach((id) => cancelQueuedExport(id));
}

async function drainQueue(dispatch: AppDispatch, getState: () => RootState) {
  if (isDraining || !executionEnabled) return;
  isDraining = true;

  try {
    while (executionEnabled && pendingJobs.length > 0) {
      const job = pendingJobs.shift();
      if (!job) continue;
      if (job.canceled) {
        jobsById.delete(job.item.id);
        continue;
      }

      job.startedAt = Date.now();
      dispatch(exportStarted({ id: job.item.id, startedAt: job.startedAt }));
      await renderJob(job);
    }
  } finally {
    isDraining = false;
    maybePerformQueueFinishAction(dispatch, getState);
    if (executionEnabled && pendingJobs.length > 0) void drainQueue(dispatch, getState);
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
            job.item.request as import("@/lib/tauri/media").OptimizedExportRequest,
            job.item.outputId,
            onProgress,
          );

    if (!job.canceled) {
      job.dispatch(exportCompleted({ id: job.item.id, result, durationMs: elapsedTime(job) }));
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
    jobsById.delete(job.item.id);
  }
}

function elapsedTime(job: RuntimeExportJob) {
  return job.startedAt ? Date.now() - job.startedAt : null;
}

function maybePerformQueueFinishAction(dispatch: AppDispatch, getState: () => RootState) {
  if (isDraining || pendingJobs.length > 0 || jobsById.size > 0 || !queueHadWork) return;
  queueHadWork = false;
  if (suppressQueueFinishAction) {
    suppressQueueFinishAction = false;
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

export function resetExportQueueRuntimeForTests() {
  pendingJobs.length = 0;
  jobsById.clear();
  isDraining = false;
  executionEnabled = false;
  queueHadWork = false;
  suppressQueueFinishAction = false;
}
