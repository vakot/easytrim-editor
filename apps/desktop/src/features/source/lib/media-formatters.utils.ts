import type { FrameRate } from "@/lib/tauri/media.types";

export function formatDuration(micros: number): string {
  const totalSeconds = Math.max(0, Math.floor(micros / 1_000_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, "0")).join(":");
}

export function formatFrameRate(
  frameRate: FrameRate | undefined,
  unknownLabel: string,
  formatUnit: (value: string) => string,
): string {
  if (!frameRate) {
    return unknownLabel;
  }
  const value = frameRate.displayValue ?? frameRate.numerator / frameRate.denominator;
  return formatUnit(value.toFixed(value % 1 === 0 ? 0 : 2));
}

export function formatBytes(bytes: number | undefined, unknownLabel: string): string {
  if (bytes === undefined) {
    return unknownLabel;
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1_000 && unit < units.length - 1) {
    value /= 1_000;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function formatBitrate(
  bitrate: number | undefined,
  unknownLabel: string,
  formatUnit: (value: string) => string,
): string {
  return bitrate === undefined ? unknownLabel : formatUnit((bitrate / 1_000_000).toFixed(2));
}

export function formatDateTime(
  micros: number | undefined,
  locale: string,
  unknownLabel: string,
): string {
  if (micros === undefined) return unknownLabel;

  const date = new Date(micros / 1_000);
  return Number.isNaN(date.getTime())
    ? unknownLabel
    : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatRelativeTime(
  micros: number | undefined,
  locale: string,
  unknownLabel: string,
  nowMs = Date.now(),
): string {
  if (micros === undefined) return unknownLabel;

  const updatedAtMs = micros / 1_000;
  const elapsedSeconds = Math.floor((nowMs - updatedAtMs) / 1_000);
  if (!Number.isFinite(elapsedSeconds) || !Number.isFinite(updatedAtMs)) return unknownLabel;

  if (elapsedSeconds < 0) return formatDateOnly(updatedAtMs, locale, unknownLabel);

  const relativeTimeFormatter = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  if (elapsedSeconds < 60) {
    return relativeTimeFormatter.format(-Math.max(1, elapsedSeconds), "second");
  }
  if (elapsedSeconds < 3_600) {
    return relativeTimeFormatter.format(-Math.floor(elapsedSeconds / 60), "minute");
  }
  if (elapsedSeconds < 86_400) {
    return relativeTimeFormatter.format(-Math.floor(elapsedSeconds / 3_600), "hour");
  }

  const updatedAt = new Date(updatedAtMs);
  const now = new Date(nowMs);
  if (isYesterday(updatedAt, now)) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-1, "day");
  }

  return formatDateOnly(updatedAtMs, locale, unknownLabel);
}

function formatDateOnly(ms: number, locale: string, unknownLabel: string): string {
  const date = new Date(ms);
  return Number.isNaN(date.getTime())
    ? unknownLabel
    : new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

function isYesterday(date: Date, now: Date): boolean {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  );
}

export function formatSourcePath(sourcePath: string): string {
  const extendedPathPrefix = "\\\\?\\";
  return sourcePath.startsWith(extendedPathPrefix)
    ? sourcePath.slice(extendedPathPrefix.length)
    : sourcePath;
}
