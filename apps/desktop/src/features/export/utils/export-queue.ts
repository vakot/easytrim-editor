import {
  cancelOperation,
  normalizeAppError,
  renderFast,
  renderOptimized,
  type ExportProgress,
  type FastExportRequest,
  type OptimizedExportRequest,
  type OutputSelection,
} from "@/lib/tauri/media";

import type { Dispatch, SetStateAction } from "react";
import type { ExportToast } from "../types";

type ExportRoute = "fast" | "optimized";
type ExportRequest = FastExportRequest | OptimizedExportRequest;

interface ExportJob {
  id: string;
  route: ExportRoute;
  request: ExportRequest;
  output: OutputSelection;
  setQueue: Dispatch<SetStateAction<ExportToast[]>>;
  canceledMessage: string;
  canceled: boolean;
  operationId: string | null;
  startedAt: number | null;
  estimatedFps: number | null;
}

const pendingJobs: ExportJob[] = [];
const jobsById = new Map<string, ExportJob>();
let isDraining = false;

export function enqueueExport(
  job: Omit<ExportJob, "canceled" | "operationId" | "startedAt" | "estimatedFps">,
) {
  const queuedJob: ExportJob = {
    ...job,
    canceled: false,
    operationId: null,
    startedAt: null,
    estimatedFps: null,
  };
  pendingJobs.push(queuedJob);
  jobsById.set(queuedJob.id, queuedJob);
  void drainQueue();
}

export function cancelQueuedExport(id: string) {
  const job = jobsById.get(id);
  if (!job || job.canceled) return;

  job.canceled = true;
  updateToast(job, (toast) => ({
    ...toast,
    status: "canceled",
    error: job.canceledMessage,
    onCancel: undefined,
    durationMs: job.startedAt ? Date.now() - job.startedAt : null,
  }));

  if (job.operationId) {
    void cancelOperation(job.operationId).catch(() => undefined);
  }
}

async function drainQueue() {
  if (isDraining) return;
  isDraining = true;

  try {
    while (pendingJobs.length > 0) {
      const job = pendingJobs.shift();
      if (!job) continue;
      if (job.canceled) {
        jobsById.delete(job.id);
        continue;
      }

      job.startedAt = Date.now();
      updateToast(job, (toast) => ({
        ...toast,
        status: "rendering",
        startedAt: job.startedAt,
      }));

      await renderJob(job);
    }
  } finally {
    isDraining = false;
  }
}

async function renderJob(job: ExportJob) {
  const onProgress = (progress: ExportProgress) => {
    if (job.canceled) {
      void cancelOperation(progress.operationId).catch(() => undefined);
      return;
    }

    job.operationId = progress.operationId;
    const durationMicros = job.request.trim.endMicros - job.request.trim.startMicros;
    const progressPercent =
      durationMicros > 0
        ? Math.min(100, Math.max(0, (progress.elapsedMicros / durationMicros) * 100))
        : 0;
    const reportedFps = parseMetric(progress.fps);
    if (reportedFps !== null) {
      job.estimatedFps =
        job.estimatedFps === null ? reportedFps : job.estimatedFps * 0.75 + reportedFps * 0.25;
    }
    updateToast(job, (toast) => ({
      ...toast,
      operationId: progress.operationId,
      durationMs: elapsedTime(job),
      progressPercent,
      estimatedFps: job.estimatedFps ?? undefined,
    }));
  };

  try {
    const result =
      job.route === "fast"
        ? await renderFast(job.request as FastExportRequest, job.output.outputId, onProgress)
        : await renderOptimized(
            job.request as OptimizedExportRequest,
            job.output.outputId,
            onProgress,
          );

    if (job.canceled) return;
    updateToast(job, (toast) => ({
      ...toast,
      operationId: result.operationId,
      path: result.displayPath,
      status: "completed",
      durationMs: elapsedTime(job),
      onCancel: undefined,
    }));
  } catch (error: unknown) {
    if (job.canceled) return;

    const normalized = normalizeAppError(error);
    const wasCanceled = normalized.code === "cancelled" || normalized.code === "source_replaced";
    updateToast(job, (toast) => ({
      ...toast,
      status: wasCanceled ? "canceled" : "failed",
      error: wasCanceled ? job.canceledMessage : normalized.message,
      durationMs: elapsedTime(job),
      onCancel: undefined,
    }));
  } finally {
    jobsById.delete(job.id);
  }
}

function parseMetric(value: string | undefined) {
  if (!value) return null;
  const multiplier = Number.parseFloat(value);
  return Number.isFinite(multiplier) && multiplier >= 0 ? multiplier : null;
}

function elapsedTime(job: ExportJob) {
  return job.startedAt ? Date.now() - job.startedAt : null;
}

function updateToast(job: ExportJob, update: (toast: ExportToast) => ExportToast) {
  job.setQueue((current) => current.map((toast) => (toast.id === job.id ? update(toast) : toast)));
}
