import {
  type AudioTrackLimiter,
  audioTrackPreviewRuntimeGainDb,
  type AudioTrackProcessing,
  getAudioTrackSignalEffect,
  sameAudioTrackPreviewProcessing,
} from "@/domain/audio-processing";

type AudioPreviewRuntimeStatus = "failed" | "idle" | "loading" | "ready" | "stale";

function getAudioTrackRuntimeLimiter(
  processing: AudioTrackProcessing,
  preview: { processing: AudioTrackProcessing; status: AudioPreviewRuntimeStatus },
  liveGainDb = processing.gainDb,
): AudioTrackLimiter | undefined {
  const limiter = getAudioTrackSignalEffect(processing, "limiter");
  if (!limiter) return undefined;

  const previewIsCurrent =
    preview.status === "ready" && sameAudioTrackPreviewProcessing(processing, preview.processing);

  const runtimeGainDb = audioTrackPreviewRuntimeGainDb(processing, preview.processing, liveGainDb);

  return previewIsCurrent && runtimeGainDb === 0 ? undefined : limiter;
}

export { getAudioTrackRuntimeLimiter };
export type { AudioPreviewRuntimeStatus };
