import type { AudioTrackMetadata } from "@/domain/audio-processing";
import type { AudioStream } from "@/domain/media";

function audioTrackDisplayName(
  metadata: AudioTrackMetadata,
  stream: Pick<AudioStream, "language" | "title">,
  fallbackName: string,
) {
  return (metadata.title || stream.title) ?? metadata.language ?? stream.language ?? fallbackName;
}

export { audioTrackDisplayName };
