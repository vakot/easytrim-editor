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
