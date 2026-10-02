import {
  type AudioTrackLimiter,
  audioTrackPreviewRuntimeGainDb,
  type AudioTrackProcessing,
  getAudioTrackSignalEffect,
} from "@/domain/audio-processing";

function getAudioTrackRuntimeLimiter(
  processing: AudioTrackProcessing,
  previewProcessing: AudioTrackProcessing,
  liveGainDb = processing.gainDb,
): AudioTrackLimiter | undefined {
  const limiter = getAudioTrackSignalEffect(processing, "limiter");
  if (!limiter) return undefined;

  const bakedLimiter = getAudioTrackSignalEffect(previewProcessing, "limiter");
  if (bakedLimiter?.ceilingDb !== limiter.ceilingDb) return limiter;

  const runtimeGainDb = audioTrackPreviewRuntimeGainDb(processing, previewProcessing, liveGainDb);

  return runtimeGainDb === 0 ? undefined : limiter;
}

export { getAudioTrackRuntimeLimiter };
