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
  if (durationMs > 0 && durationMs < 1_000) {
    const centiseconds = Math.round(durationMs / 10);
    if (centiseconds >= 100) return "0:01";
    return `0:00.${String(centiseconds).padStart(2, "0")}`;
  }

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
  attempt: Pick<ExportAttempt, "metrics" | "request" | "state">,
  status: ExportAttemptState["status"] = attempt.state.status,
): ExportMetricValues {
  const { metrics } = attempt;
  const totalFrames = positiveNumber(metrics.totalFrames);
  const frame = nonNegativeNumber(metrics.currentFrame);
  const progressMetricIsUseful =
    metrics.phase === "running" ||
    metrics.phase === "completed" ||
    (metrics.phase !== "preparing" && metrics.progressPercent > 0);

  const progressFromFfmpeg = progressMetricIsUseful && metrics.progressAvailable !== false
    ? boundedPercent(metrics.progressPercent)
    : null;

  const progressFromFrames =
    frame !== undefined &&
    totalFrames !== undefined &&
    (metrics.phase !== "preparing" || frame > 0)
      ? boundedPercent((frame / totalFrames) * 100)
      : null;

  const progressPercent = status === "completed" ? 100 : (progressFromFfmpeg ?? progressFromFrames);
  const progressRatio = progressPercent === null ? null : progressPercent / 100;
  const durationMs = nonNegativeNumber(metrics.durationMs) ?? null;
  const segmentDurationMs = Math.max(
    0,
    (attempt.request.trim.endMicros - attempt.request.trim.startMicros) / 1_000,
  );

  const mediaElapsedMs =
    progressRatio === null ? null : segmentDurationMs * Math.min(progressRatio, 1);

  const bitrateBitsPerSecond = parseFfmpegBitrate(metrics.bitrate);
  const fileSizeBytes =
    nonNegativeNumber(metrics.fileSizeBytes) ??
    (bitrateBitsPerSecond !== null && mediaElapsedMs !== null
      ? (bitrateBitsPerSecond * mediaElapsedMs) / 8_000
      : undefined);

  const estimatedTotalTimeMs =
    positiveNumber(metrics.estimatedTotalTimeMs) ??
    (durationMs !== null && durationMs > 0 && progressRatio !== null && progressRatio > 0
      ? durationMs / progressRatio
      : undefined);

  const estimatedFileSizeBytes =
    nonNegativeNumber(metrics.estimatedFileSizeBytes) ??
    (fileSizeBytes !== undefined && progressRatio !== null && progressRatio > 0 && fileSizeBytes > 0
      ? fileSizeBytes / progressRatio
      : bitrateBitsPerSecond !== null
        ? (bitrateBitsPerSecond * segmentDurationMs) / 8_000
        : undefined);

  const fps =
    positiveNumber(metrics.fps) ??
    (frame !== undefined && durationMs !== null && durationMs > 0
      ? (frame * 1_000) / durationMs
      : undefined);

  const bitrate =
    (bitrateBitsPerSecond === null ? undefined : metrics.bitrate) ??
    (fileSizeBytes !== undefined && mediaElapsedMs !== null && mediaElapsedMs > 0
      ? formatExportBitrate((fileSizeBytes * 8_000) / mediaElapsedMs)
      : undefined);

  const currentFrame =
    frame ??
    (totalFrames !== undefined && progressRatio !== null
      ? Math.round(totalFrames * progressRatio)
      : undefined);

  const estimatedElapsedTimeMs = nonNegativeNumber(metrics.estimatedElapsedTimeMs) ?? durationMs;
  const indeterminate = status === "rendering" && progressPercent === null;

  return {
    bitrate,
    currentFrame,
    durationMs,
    estimatedElapsedTimeMs: estimatedElapsedTimeMs ?? undefined,
    estimatedFileSizeBytes,
    estimatedTotalTimeMs,
    fileSizeBytes,
    fps,
    indeterminate,
    progressPercent: status === "queued" ? null : progressPercent,
    totalFrames,
  };
}

function boundedPercent(value: number): number | null {
  const percent = nonNegativeNumber(value);
  return percent === undefined ? null : Math.min(percent, 100);
}

function nonNegativeNumber(value: number | null | undefined): number | undefined {
  return value !== undefined && value !== null && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function positiveNumber(value: number | null | undefined): number | undefined {
  const number = nonNegativeNumber(value);
  return number !== undefined && number > 0 ? number : undefined;
}

function formatExportBitrate(bitsPerSecond: number) {
  if (!Number.isFinite(bitsPerSecond) || bitsPerSecond <= 0) return undefined;
  if (bitsPerSecond < 1_000) return `${Math.round(bitsPerSecond)} bits/s`;
  if (bitsPerSecond < 1_000_000) return `${(bitsPerSecond / 1_000).toFixed(1)} kbits/s`;
  if (bitsPerSecond < 1_000_000_000) return `${(bitsPerSecond / 1_000_000).toFixed(1)} Mbits/s`;
  return `${(bitsPerSecond / 1_000_000_000).toFixed(1)} Gbits/s`;
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
