import type { ExportAttempt, ExportAttemptState } from "./editing-instance";

const BITRATE_UNITS: Record<string, number> = {
  bits: 1,
  kbits: 1_000,
  mbits: 1_000_000,
  gbits: 1_000_000_000,
};

function parseFfmpegNumber(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!/^[0-9]+(?:\.[0-9]+)?$/.test(normalized)) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseFfmpegSpeed(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)x$/i);
  const valueText = match?.[1];
  if (valueText === undefined) return null;
  const speed = Number.parseFloat(valueText);
  return Number.isFinite(speed) && speed > 0 ? speed : null;
}

function parseFfmpegBitrate(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*(bits|kbits|mbits|gbits)\/s$/i);
  const valueText = match?.[1];
  const unitText = match?.[2];
  if (valueText === undefined || unitText === undefined) return null;
  const unit = BITRATE_UNITS[unitText.toLowerCase()];
  if (unit === undefined) return null;
  const bitrate = Number.parseFloat(valueText) * unit;
  return Number.isFinite(bitrate) && bitrate > 0 ? bitrate : null;
}

function estimateExportTime(
  elapsedMicros: number,
  totalMicros: number,
  speed: string | undefined,
): { elapsedMs: number; totalMs: number } | null {
  const multiplier = parseFfmpegSpeed(speed);
  if (
    multiplier === null ||
    !Number.isSafeInteger(elapsedMicros) ||
    !Number.isSafeInteger(totalMicros) ||
    elapsedMicros < 0 ||
    totalMicros <= 0
  ) {
    return null;
  }

  const elapsed = Math.min(elapsedMicros, totalMicros);
  return {
    elapsedMs: Math.round(elapsed / multiplier / 1_000),
    totalMs: Math.round(totalMicros / multiplier / 1_000),
  };
}

function estimateExportSize(
  totalSize: number | undefined,
  bitrate: string | undefined,
  elapsedMicros: number,
  totalMicros: number,
): { currentBytes: number; totalBytes: number } | null {
  if (
    totalSize === undefined ||
    !Number.isSafeInteger(totalSize) ||
    totalSize < 0 ||
    !Number.isSafeInteger(elapsedMicros) ||
    !Number.isSafeInteger(totalMicros) ||
    totalMicros <= 0
  ) {
    return null;
  }

  const bitrateBitsPerSecond = parseFfmpegBitrate(bitrate);
  const estimatedBytes =
    bitrateBitsPerSecond === null
      ? elapsedMicros > 0
        ? (totalSize * totalMicros) / elapsedMicros
        : null
      : (bitrateBitsPerSecond * (totalMicros / 1_000_000)) / 8;

  if (estimatedBytes === null || !Number.isFinite(estimatedBytes)) return null;

  return {
    currentBytes: totalSize,
    totalBytes: Math.max(totalSize, Math.round(estimatedBytes)),
  };
}

function formatExportDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatExportFileSize(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = -1;
  while (value >= 1_024 && unitIndex < units.length - 1) {
    value /= 1_024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

interface ExportMetricValues {
  bitrate?: string;
  currentFrame?: number;
  durationMs: number | null;
  estimatedElapsedTimeMs?: number;
  estimatedFileSizeBytes?: number;
  estimatedTotalTimeMs?: number;
  fileSizeBytes?: number;
  fps?: number;
  indeterminate: boolean;
  progressPercent: number | null;
  totalFrames?: number;
}

function getExportMetricValues(
  attempt: Pick<ExportAttempt, "metrics" | "route" | "state">,
  status: ExportAttemptState["status"] = attempt.state.status,
): ExportMetricValues {
  const { metrics } = attempt;
  const indeterminate = status === "rendering" && attempt.route === "gif";
  const metricsAvailable = !indeterminate;

  return {
    bitrate: metricsAvailable ? metrics.bitrate : undefined,
    currentFrame: metricsAvailable ? metrics.currentFrame : undefined,
    durationMs: metricsAvailable ? metrics.durationMs : null,
    estimatedElapsedTimeMs: metricsAvailable ? metrics.estimatedElapsedTimeMs : undefined,
    estimatedFileSizeBytes: metricsAvailable ? metrics.estimatedFileSizeBytes : undefined,
    estimatedTotalTimeMs: metricsAvailable ? metrics.estimatedTotalTimeMs : undefined,
    fileSizeBytes: metricsAvailable ? metrics.fileSizeBytes : undefined,
    fps: metricsAvailable ? metrics.fps : undefined,
    indeterminate,
    progressPercent:
      indeterminate ||
      status === "queued" ||
      (status !== "completed" && metrics.progressPercent <= 0)
        ? null
        : metrics.progressPercent,
    totalFrames: metricsAvailable ? metrics.totalFrames : undefined,
  };
}

export {
  estimateExportSize,
  estimateExportTime,
  formatExportDuration,
  formatExportFileSize,
  getExportMetricValues,
  parseFfmpegBitrate,
  parseFfmpegNumber,
  parseFfmpegSpeed,
};

export type { ExportMetricValues };
