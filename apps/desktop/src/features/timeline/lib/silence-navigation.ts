import type { SilenceRange } from "@/lib/tauri/media.types";

function findPreviousSilence(ranges: readonly SilenceRange[], playheadMicros: number) {
  let previousStart: number | undefined;
  for (const range of ranges) {
    if (range.startMicros < playheadMicros) previousStart = range.startMicros;
    else break;
  }
  return previousStart;
}

function findNextSilence(ranges: readonly SilenceRange[], playheadMicros: number) {
  return ranges.find((range) => range.startMicros > playheadMicros)?.startMicros;
}

export { findNextSilence, findPreviousSilence };
