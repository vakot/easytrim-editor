import type { FrameRate } from "@/domain/media";
import { frameToMicros } from "@/domain/media-time";

function formatFrameTimecode(frame: number, frameRate: FrameRate | undefined) {
  const totalFrames = Math.max(0, Math.round(Number.isFinite(frame) ? frame : 0));
  const validFrameRate =
    frameRate && frameRate.numerator > 0 && frameRate.denominator > 0
      ? frameRate
      : { denominator: 1, numerator: 30 };

  const nominalFramesPerSecond = Math.max(
    1,
    Math.round(validFrameRate.numerator / validFrameRate.denominator),
  );

  const wholeSeconds = Math.floor(frameToMicros(totalFrames, validFrameRate) / 1_000_000);

  const firstFrameInSecond = Math.ceil(
    (wholeSeconds * validFrameRate.numerator) / validFrameRate.denominator,
  );

  const frames = Math.min(
    nominalFramesPerSecond - 1,
    Math.max(0, totalFrames - firstFrameInSecond),
  );

  const hours = Math.floor(wholeSeconds / 3_600);
  const minutes = Math.floor((wholeSeconds % 3_600) / 60);
  const seconds = wholeSeconds % 60;

  // This is elapsed-time notation, not SMPTE drop-frame timecode: clock fields use exact rational
  // frame timestamps, and the final field is the zero-based frame ordinal within that second.
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}:${frames
    .toString()
    .padStart(2, "0")}`;
}

export { formatFrameTimecode };
