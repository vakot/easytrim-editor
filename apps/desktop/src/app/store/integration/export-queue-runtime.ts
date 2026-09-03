import {
  editingInstanceExportCanceled,
  editingInstanceExportCompleted,
  editingInstanceExportFailed,
  editingInstanceExportProgressReceived,
  editingInstanceExportStarted,
  editingInstancesSourceAvailabilityChanged,
  selectEditingInstanceAttempts,
} from "@/app/store/slices/editing-instances-slice";
import type { AppDispatch, RootState } from "@/app/store/store";
import type { EditingInstanceId, ExportAttempt } from "@/domain/editing-instance";
import {
  estimateExportSize,
  estimateExportTime,
  parseFfmpegBitrate,
  parseFfmpegNumber,
} from "@/domain/export-metrics";
import { normalizeSourceKey } from "@/domain/source";
import { type DiagnosticOperation, diagnostics } from "@/lib/diagnostics";
import {
  cancelOperation,
  moveSourceToTrash,
  releaseExportSource,
  renderFast,
  renderOptimized,
} from "@/lib/tauri/media";
import type { ExportProgress, OptimizedExportRequest } from "@/lib/tauri/media.types";
import { normalizeAppError } from "@/lib/tauri/media.utils";
import { performQueueFinishAction } from "@/lib/tauri/queue";

interface RuntimeExportJob {
  attempt: ExportAttempt;
  canceled: boolean;
  completion: Promise<void>;
  diagnosticsOperation: DiagnosticOperation | null;
  dispatch: AppDispatch;
  getState: () => RootState;
  instanceId: EditingInstanceId;
  lastDiagnosticProgress: number;
  lastReduxProgressAt: number;
  operationId: string | null;
  resolveCompletion: () => void;
  startedAt: number | null;
}

interface RuntimeState {
  deferredSourceDeletes: Map<string, string>;
  executionEnabled: boolean;
  isDraining: boolean;
  jobsByAttemptId: Map<string, RuntimeExportJob>;
  jobsByInstanceId: Map<EditingInstanceId, RuntimeExportJob>;
  jobsBySourceKey: Map<string, Set<RuntimeExportJob>>;
  pendingJobs: RuntimeExportJob[];
  queueCycle: "idle" | "running" | "finishing";
  suppressQueueFinishAction: boolean;
}

const runtimeByStore = new WeakMap<() => RootState, RuntimeState>();

function runtimeFor(getState: () => RootState): RuntimeState {
  const existing = runtimeByStore.get(getState);
  if (existing) return existing;
  const runtime: RuntimeState = {
    executionEnabled: false,
    isDraining: false,
    jobsByInstanceId: new Map(),
    jobsByAttemptId: new Map(),
    jobsBySourceKey: new Map(),
    pendingJobs: [],
    deferredSourceDeletes: new Map(),
    queueCycle: "idle",
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
  instanceId: EditingInstanceId,
  attempt: ExportAttempt,
  dispatch: AppDispatch,
  getState: () => RootState,
) {
  const runtime = runtimeFor(getState);
  if (runtime.jobsByAttemptId.has(attempt.id)) return false;
  if (runtime.jobsByInstanceId.has(instanceId)) return false;

  const job: RuntimeExportJob = {
    attempt,
    canceled: false,
    diagnosticsOperation: null,
    dispatch,
    getState,
    instanceId,
    lastDiagnosticProgress: -1,
    lastReduxProgressAt: 0,
    operationId: null,
    startedAt: null,
    completion: Promise.resolve(),
    resolveCompletion: () => undefined,
  };

  job.completion = new Promise<void>((resolve) => {
    job.resolveCompletion = resolve;
  });
  runtime.pendingJobs.push(job);
  runtime.jobsByAttemptId.set(attempt.id, job);
  runtime.jobsByInstanceId.set(instanceId, job);
  const sourceKey = normalizeSourceKey(attempt.request.sourcePath);
  const sourceJobs = runtime.jobsBySourceKey.get(sourceKey);
  if (sourceJobs) sourceJobs.add(job);
  else runtime.jobsBySourceKey.set(sourceKey, new Set([job]));
  if (runtime.queueCycle === "idle") runtime.queueCycle = "running";
  void drainQueue(runtime, dispatch, getState);
  return true;
}

export function cancelQueuedExport(
  instanceId: EditingInstanceId,
  attemptId: string,
  getState: () => RootState,
) {
  const runtime = runtimeFor(getState);
  const job = runtime.jobsByAttemptId.get(attemptId);
  if (!job || job.instanceId !== instanceId || job.canceled) return Promise.resolve();

  job.canceled = true;
  job.diagnosticsOperation?.cancel({ reason: "user_requested" });
  job.dispatch(
    editingInstanceExportCanceled({ id: instanceId, attemptId, durationMs: elapsedTime(job) }),
  );
  if (job.startedAt === null) {
    removePendingJob(runtime, job);
    return releaseExportSource(job.attempt.request.sourcePath)
      .catch(() => undefined)
      .then(() => {
        job.resolveCompletion();
        maybePerformQueueFinishAction(runtime, job.dispatch, getState);
      });
  }
  if (job.operationId) void cancelOperation(job.operationId).catch(() => undefined);
  return job.completion;
}

export function cancelInstanceExports(instanceId: EditingInstanceId, getState: () => RootState) {
  const runtime = runtimeFor(getState);
  return Promise.all(
    [...runtime.jobsByAttemptId.values()]
      .filter((job) => job.instanceId === instanceId)
      .map((job) => cancelQueuedExport(instanceId, job.attempt.id, getState)),
  ).then(() => undefined);
}

export function cancelActiveExport(getState: () => RootState) {
  const runtime = runtimeFor(getState);
  const activeJob = [...runtime.jobsByAttemptId.values()].find((job) => job.startedAt !== null);
  if (activeJob) return cancelQueuedExport(activeJob.instanceId, activeJob.attempt.id, getState);
  return Promise.resolve();
}

export function cancelAllQueuedExports(getState: () => RootState) {
  const runtime = runtimeFor(getState);
  runtime.suppressQueueFinishAction = true;
  return Promise.all(
    [...runtime.jobsByAttemptId.values()].map((job) =>
      cancelQueuedExport(job.instanceId, job.attempt.id, getState),
    ),
  ).then(() => undefined);
}

export function hasActiveExportForSource(sourcePath: string, getState: () => RootState): boolean {
  return (runtimeFor(getState).jobsBySourceKey.get(normalizeSourceKey(sourcePath))?.size ?? 0) > 0;
}

function removePendingJob(runtime: RuntimeState, job: RuntimeExportJob) {
  const pendingIndex = runtime.pendingJobs.indexOf(job);
  if (pendingIndex >= 0) runtime.pendingJobs.splice(pendingIndex, 1);
  unregisterJob(runtime, job);
}

function unregisterJob(runtime: RuntimeState, job: RuntimeExportJob) {
  runtime.jobsByAttemptId.delete(job.attempt.id);
  if (runtime.jobsByInstanceId.get(job.instanceId) === job) {
    runtime.jobsByInstanceId.delete(job.instanceId);
  }
  const sourceKey = normalizeSourceKey(job.attempt.request.sourcePath);
  const sourceJobs = runtime.jobsBySourceKey.get(sourceKey);
  sourceJobs?.delete(job);
  if (sourceJobs?.size === 0) runtime.jobsBySourceKey.delete(sourceKey);
}

async function drainQueue(runtime: RuntimeState, dispatch: AppDispatch, getState: () => RootState) {
  if (runtime.isDraining || !runtime.executionEnabled) return;
  runtime.isDraining = true;
  try {
    while (runtime.executionEnabled && runtime.pendingJobs.length > 0) {
      const job = runtime.pendingJobs.shift();
      if (!job) continue;
      if (job.canceled) {
        unregisterJob(runtime, job);
        job.resolveCompletion();
        continue;
      }
      job.startedAt = Date.now();
      dispatch(
        editingInstanceExportStarted({
          id: job.instanceId,
          attemptId: job.attempt.id,
          startedAt: job.startedAt,
        }),
      );
      job.diagnosticsOperation = diagnostics.startOperation("ffmpeg.export", {
        data: {
          attemptId: job.attempt.id,
          instanceId: job.instanceId,
          outputPath: job.attempt.output.displayPath,
          outputType: job.attempt.route,
          sourcePath: job.attempt.request.sourcePath,
        },
        origin: { type: "internal" },
        snapshotId: job.instanceId,
      });
      await renderJob(job);
    }
  } finally {
    runtime.isDraining = false;
    maybePerformQueueFinishAction(runtime, dispatch, getState);
    if (runtime.executionEnabled && runtime.pendingJobs.length > 0)
      void drainQueue(runtime, dispatch, getState);
  }
}

async function renderJob(job: RuntimeExportJob) {
  const onProgress = (progress: ExportProgress) => {
    if (job.canceled) {
      void cancelOperation(progress.operationId).catch(() => undefined);
      return;
    }
    job.operationId = progress.operationId;
    const durationMicros =
      job.attempt.request.trim.endMicros - job.attempt.request.trim.startMicros;

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

    if (
      progressPercent === 100 ||
      progressPercent - job.lastDiagnosticProgress >= 10 ||
      job.lastDiagnosticProgress < 0
    ) {
      job.lastDiagnosticProgress = progressPercent;
      diagnostics.event("ffmpeg.progress.reported", {
        data: { percent: Math.round(progressPercent), phase: progress.phase },
        operationId: job.diagnosticsOperation?.operationId,
        snapshotId: job.instanceId,
      });
    }
    const now = Date.now();
    if (
      progress.phase !== "completed" &&
      now - job.lastReduxProgressAt < 100 &&
      progressPercent < 100
    ) {
      return;
    }
    job.lastReduxProgressAt = now;
    job.dispatch(
      editingInstanceExportProgressReceived({
        id: job.instanceId,
        attemptId: job.attempt.id,
        progress,
        metrics: {
          durationMs: elapsedTime(job),
          progressPercent,
          currentFrame: progress.frame,
          fileSizeBytes: progress.totalSize,
          fps: parseFfmpegNumber(progress.fps) ?? undefined,
          bitrate: parseFfmpegBitrate(progress.bitrate) === null ? undefined : progress.bitrate,
          estimatedFileSizeBytes: estimatedSize?.totalBytes,
          estimatedElapsedTimeMs: estimatedTime?.elapsedMs,
          estimatedTotalTimeMs: estimatedTime?.totalMs,
        },
      }),
    );
  };

  try {
    const result =
      job.attempt.route === "fast"
        ? await renderFast(
            job.attempt.request,
            job.attempt.output.outputId,
            onProgress,
            job.diagnosticsOperation?.operationId,
            job.instanceId,
          )
        : await renderOptimized(
            job.attempt.request as OptimizedExportRequest,
            job.attempt.output.outputId,
            onProgress,
            job.diagnosticsOperation?.operationId,
            job.instanceId,
          );

    if (!job.canceled) {
      job.dispatch(
        editingInstanceExportCompleted({
          id: job.instanceId,
          attemptId: job.attempt.id,
          result,
          durationMs: elapsedTime(job),
        }),
      );
      job.diagnosticsOperation?.complete({ outputType: job.attempt.route });
      if (job.getState().preferences.deleteSourceOnRenderFinish) {
        await deleteSourceWhenUnused(job, job.attempt.request.sourcePath);
      }
    }
  } catch (error: unknown) {
    if (!job.canceled) {
      const normalized = normalizeAppError(error);
      job.diagnosticsOperation?.fail(normalized);
      job.dispatch(
        editingInstanceExportFailed({
          id: job.instanceId,
          attemptId: job.attempt.id,
          error: normalized,
          durationMs: elapsedTime(job),
        }),
      );
    }
  } finally {
    unregisterJob(runtimeFor(job.getState), job);
    job.resolveCompletion();
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
    runtime.jobsByAttemptId.size > 0 ||
    runtime.queueCycle !== "running"
  )
    return;
  runtime.queueCycle = "finishing";
  void finishQueueCycle(runtime, dispatch, getState);
}

async function finishQueueCycle(
  runtime: RuntimeState,
  dispatch: AppDispatch,
  getState: () => RootState,
) {
  await flushDeferredSourceDeletes(runtime, dispatch);
  if (runtime.pendingJobs.length > 0 || runtime.jobsByAttemptId.size > 0) {
    runtime.queueCycle = "running";
    return;
  }

  runtime.queueCycle = "idle";
  if (runtime.suppressQueueFinishAction) {
    runtime.suppressQueueFinishAction = false;
    return;
  }
  const hasTerminalWork = selectEditingInstanceAttempts(getState()).some(
    ({ attempt }) => attempt.state.status === "completed" || attempt.state.status === "failed",
  );

  if (!hasTerminalWork) return;
  const action = getState().export.queueFinishAction;
  if (action !== "nothing") void performQueueFinishAction(action).catch(() => undefined);
  void dispatch;
}

async function deleteSourceWhenUnused(job: RuntimeExportJob, sourcePath: string) {
  const runtime = runtimeFor(job.getState);
  const sourceJobs = runtime.jobsBySourceKey.get(normalizeSourceKey(sourcePath));
  const hasDependentJob = sourceJobs
    ? [...sourceJobs].some((candidate) => candidate !== job)
    : false;

  if (hasDependentJob) {
    runtime.deferredSourceDeletes.set(normalizeSourceKey(sourcePath), sourcePath);
    return;
  }
  runtime.deferredSourceDeletes.delete(normalizeSourceKey(sourcePath));
  await moveSourceToTrashAndMarkDeleted(job.dispatch, sourcePath, job.instanceId);
}

async function flushDeferredSourceDeletes(runtime: RuntimeState, dispatch: AppDispatch) {
  const sourcePaths = [...runtime.deferredSourceDeletes.values()];
  runtime.deferredSourceDeletes.clear();
  await Promise.all(
    sourcePaths.map((sourcePath) => moveSourceToTrashAndMarkDeleted(dispatch, sourcePath)),
  );
}

async function moveSourceToTrashAndMarkDeleted(
  dispatch: AppDispatch,
  sourcePath: string,
  snapshotId?: string,
) {
  try {
    await moveSourceToTrash(sourcePath);
    dispatch(editingInstancesSourceAvailabilityChanged({ availability: "deleted", sourcePath }));
  } catch (error: unknown) {
    diagnostics.error("source.file-delete.failed", error, {
      origin: { type: "internal" },
      ...(snapshotId ? { snapshotId } : {}),
    });
  }
}
