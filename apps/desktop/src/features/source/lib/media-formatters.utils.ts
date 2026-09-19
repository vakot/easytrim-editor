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
): string {
  if (micros === undefined) return unknownLabel;

  const elapsedSeconds = micros / 1_000_000 - Date.now() / 1_000;
  if (!Number.isFinite(elapsedSeconds)) return unknownLabel;

  const units = [
    { seconds: 31_536_000, unit: "year" as const },
    { seconds: 2_592_000, unit: "month" as const },
    { seconds: 604_800, unit: "week" as const },
    { seconds: 86_400, unit: "day" as const },
    { seconds: 3_600, unit: "hour" as const },
    { seconds: 60, unit: "minute" as const },
    { seconds: 1, unit: "second" as const },
  ];
  const unit = units.find(({ seconds }) => Math.abs(elapsedSeconds) >= seconds) ?? units.at(-1)!;

  return new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(
    Math.round(elapsedSeconds / unit.seconds),
    unit.unit,
  );
}

export function formatSourcePath(sourcePath: string): string {
  const extendedPathPrefix = "\\\\?\\";
  return sourcePath.startsWith(extendedPathPrefix)
    ? sourcePath.slice(extendedPathPrefix.length)
    : sourcePath;
}
