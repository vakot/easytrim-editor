import { getSizeChangePresentation } from "@/components/size-change.utils";
import type { ExportAttempt, ExportAttemptState } from "@/domain/editing-instance";
import {
  formatExportDuration,
  formatExportFileSize,
  formatFileSizeChangePercent,
  getExportMetricValues,
  getFileSizeChangeRatio,
} from "@/domain/export-metrics";

import type { ExportQueueItemMetricConfig } from "../types";

function getProgress(
  attempt: ExportAttempt,
  { status = attempt.state.status }: { status?: ExportAttemptState["status"] } = {},
): ExportQueueItemMetricConfig | null {
  const progressPercent = getExportMetricValues(attempt, status).progressPercent;
  if (progressPercent === null) return null;

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
  const { durationMs, estimatedElapsedTimeMs, estimatedTotalTimeMs } = getExportMetricValues(
    attempt,
    status,
  );

  if (durationMs === null) return null;

  const elapsedMs = estimatedElapsedTimeMs ?? durationMs;
  const duration =
    status === "rendering" && estimatedTotalTimeMs !== undefined
      ? `${formatExportDuration(elapsedMs)} / ${formatExportDuration(estimatedTotalTimeMs)}`
      : formatExportDuration(durationMs);

  return {
    id: "duration",
    value:
      status === "rendering" && estimatedTotalTimeMs === undefined
        ? formatValue(duration)
        : duration,
  };
}

function getFileSize(
  attempt: ExportAttempt,
  {
    formatValue = formatExportFileSize,
    status = attempt.state.status,
  }: { formatValue?: (bytes: number) => string; status?: ExportAttemptState["status"] } = {},
): ExportQueueItemMetricConfig | null {
  const fileSizeBytes = getExportMetricValues(attempt, status).fileSizeBytes;
  if (fileSizeBytes === undefined) return null;

  return {
    id: "file-size",
    value: formatValue(fileSizeBytes),
  };
}

function getFps(
  attempt: ExportAttempt,
  {
    formatValue,
    status = attempt.state.status,
  }: { formatValue: (value: string) => string; status?: ExportAttemptState["status"] },
): ExportQueueItemMetricConfig | null {
  const fps = getExportMetricValues(attempt, status).fps;
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
    locale = "en",
    status = attempt.state.status,
  }: {
    formatValue: (value: string) => string;
    locale?: string;
    status?: ExportAttemptState["status"];
  },
): ExportQueueItemMetricConfig | null {
  const sourceSizeBytes = attempt.snapshot.source.fileSizeBytes;
  const outputSizeBytes = getExportMetricValues(attempt, status).fileSizeBytes;
  if (
    attempt.route === "audio" ||
    status !== "completed" ||
    sourceSizeBytes === undefined ||
    sourceSizeBytes <= 0 ||
    outputSizeBytes === undefined
  ) {
    return null;
  }

  const difference = outputSizeBytes - sourceSizeBytes;
  const { className, icon, sign } = getSizeChangePresentation(difference);
  const percentage = formatFileSizeChangePercent(
    getFileSizeChangeRatio(sourceSizeBytes, outputSizeBytes),
    locale,
  );

  const sizeDifference = formatExportFileSize(Math.abs(difference));
  const value = `${sign}${percentage} (${sizeDifference})`;

  return {
    ariaLabel: formatValue(value),
    className,
    icon,
    id: "file-size-change",
    value,
  };
}

export { getDuration, getFileSize, getFileSizeChange, getFps, getProgress };
