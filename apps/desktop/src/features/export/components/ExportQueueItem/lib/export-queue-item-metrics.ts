import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import type { ExportAttempt, ExportAttemptState } from "@/domain/editing-instance";
import { formatExportDuration, formatExportFileSize } from "@/domain/export-metrics";

import type { ExportQueueItemMetricConfig } from "../types";

function getProgress(
  attempt: ExportAttempt,
  { status = attempt.state.status }: { status?: ExportAttemptState["status"] } = {},
): ExportQueueItemMetricConfig | null {
  const progressPercent = attempt.metrics.progressPercent;
  if (status === "queued" || (status !== "completed" && progressPercent <= 0)) return null;

  return {
    id: "progress",
    value: `${Math.round(progressPercent)}%`,
  };
}

function getDuration(
  attempt: ExportAttempt,
  {
    formatValue,
    status = attempt.state.status,
  }: {
    formatValue: (value: string) => string;
    status?: ExportAttemptState["status"];
  },
): ExportQueueItemMetricConfig | null {
  const durationMs = attempt.metrics.durationMs;
  if (durationMs === null) return null;

  const duration = formatExportDuration(durationMs);
  return {
    id: "duration",
    value: status === "rendering" ? formatValue(duration) : duration,
  };
}

function getRemaining(
  attempt: ExportAttempt,
  {
    formatValue,
    status = attempt.state.status,
  }: {
    formatValue: (value: string) => string;
    status?: ExportAttemptState["status"];
  },
): ExportQueueItemMetricConfig | null {
  const { durationMs, estimatedTotalTimeMs } = attempt.metrics;
  if (status !== "rendering" || durationMs === null || estimatedTotalTimeMs === undefined) {
    return null;
  }

  const remainingMs = estimatedTotalTimeMs - durationMs;
  if (remainingMs <= 0) return null;

  return {
    id: "remaining",
    value: formatValue(formatExportDuration(remainingMs)),
  };
}

function getFileSize(
  attempt: ExportAttempt,
  { formatValue = formatExportFileSize }: { formatValue?: (bytes: number) => string } = {},
): ExportQueueItemMetricConfig | null {
  const fileSizeBytes = attempt.metrics.fileSizeBytes;
  if (fileSizeBytes === undefined) return null;

  return {
    id: "file-size",
    value: formatValue(fileSizeBytes),
  };
}

function getFps(
  attempt: ExportAttempt,
  { formatValue }: { formatValue: (value: string) => string },
): ExportQueueItemMetricConfig | null {
  const fps = attempt.metrics.fps;
  if (attempt.route === "audio" || fps === undefined) return null;

  return {
    id: "fps",
    value: formatValue(fps.toFixed(1)),
  };
}

function getFileSizeChange(
  attempt: ExportAttempt,
  {
    formatValue,
    status = attempt.state.status,
  }: {
    formatValue: (value: string) => string;
    status?: ExportAttemptState["status"];
  },
): ExportQueueItemMetricConfig | null {
  const sourceSizeBytes = attempt.snapshot.source.fileSizeBytes;
  const outputSizeBytes = attempt.metrics.fileSizeBytes;
  if (
    attempt.route === "audio" ||
    status !== "completed" ||
    sourceSizeBytes === undefined ||
    sourceSizeBytes <= 0 ||
    outputSizeBytes === undefined
  ) {
    return null;
  }

  const percentChange = Math.round(((outputSizeBytes - sourceSizeBytes) / sourceSizeBytes) * 100);
  const direction = percentChange < 0 ? "down" : percentChange > 0 ? "up" : "same";
  const sizeDifference = formatExportFileSize(Math.abs(outputSizeBytes - sourceSizeBytes));
  const value = `${percentChange > 0 ? "+" : ""}${percentChange}% (${sizeDifference})`;

  return {
    ariaLabel: formatValue(value),
    className:
      direction === "down"
        ? "text-green-500"
        : direction === "up"
          ? "text-destructive"
          : "text-muted-foreground",
    icon: direction === "down" ? ArrowDown : direction === "up" ? ArrowUp : Minus,
    id: "file-size-change",
    value,
  };
}

export { getDuration, getFileSize, getFileSizeChange, getFps, getProgress, getRemaining };
