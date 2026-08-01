import type { AudioStream } from "@/lib/tauri/media";

export const MIN_SLIDER_DECIBELS = -24;
export const MAX_SLIDER_DECIBELS = 6;

export function volumePercentToDecibels(volumePercent: number): number {
  if (volumePercent <= 0) return MIN_SLIDER_DECIBELS;
  const decibels = Math.max(
    MIN_SLIDER_DECIBELS,
    Math.min(MAX_SLIDER_DECIBELS, 20 * Math.log10(volumePercent / 50)),
  );
  return Math.round(decibels * 10) / 10;
}

export function decibelsToVolumePercent(decibels: number): number {
  if (decibels <= MIN_SLIDER_DECIBELS) return 0;
  return 50 * 10 ** (decibels / 20);
}

export function formatDecibels(volumePercent: number): string {
  if (volumePercent <= 0) return "−∞ dB";
  const decibels = 20 * Math.log10(volumePercent / 50);
  return `${decibels >= 0 ? "+" : ""}${decibels.toFixed(1)} dB`;
}

export function formatChannels(stream: AudioStream): string {
  if (stream.channelLayout) return stream.channelLayout;
  return stream.channels === undefined
    ? "unknown layout"
    : `${stream.channels} channel${stream.channels === 1 ? "" : "s"}`;
}

export function audioOutputSummary(enabledCount: number, mergeAudio: boolean): string {
  if (enabledCount === 0) return "Video-only output";
  if (mergeAudio && enabledCount > 1) {
    return "Fast cut + audio merge — video stays copied; selected audio is encoded.";
  }
  if (mergeAudio) return "One selected track — no merge is needed.";
  return `${enabledCount} selected track${enabledCount === 1 ? "" : "s"} kept separately.`;
}
