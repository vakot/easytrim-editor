import type { BinaryCapability, FrameRate } from "@/lib/tauri/media";

export function capabilityError(label: string, capability: BinaryCapability): string | null {
  return capability.available ? null : `${label}: ${capability.error ?? "not available."}`;
}

export function formatDuration(micros: number): string {
  const totalSeconds = Math.max(0, Math.floor(micros / 1_000_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, "0")).join(":");
}

export function formatFrameRate(frameRate: FrameRate | undefined): string {
  if (!frameRate) {
    return "Unknown";
  }
  const value = frameRate.displayValue ?? frameRate.numerator / frameRate.denominator;
  return `${value.toFixed(value % 1 === 0 ? 0 : 2)} fps`;
}

export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined) {
    return "Unknown";
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

export function formatBitrate(bitrate: number | undefined): string {
  return bitrate === undefined ? "Unknown" : `${(bitrate / 1_000_000).toFixed(2)} Mbps`;
}
