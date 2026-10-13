import type { FrameRate } from "@/domain/media";

function formatFrameTimecode(frame: number, frameRate: FrameRate | undefined) {
  const totalFrames = Math.max(0, Math.round(Number.isFinite(frame) ? frame : 0));
  const framesPerSecond = Math.max(
    1,
    frameRate && frameRate.numerator > 0 && frameRate.denominator > 0
      ? Math.round(frameRate.numerator / frameRate.denominator)
      : 30,
  );

  const wholeSeconds = Math.floor(totalFrames / framesPerSecond);
  const frames = totalFrames % framesPerSecond;
  const hours = Math.floor(wholeSeconds / 3_600);
  const minutes = Math.floor((wholeSeconds % 3_600) / 60);
  const seconds = wholeSeconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}:${frames
    .toString()
    .padStart(2, "0")}f`;
}

export { formatFrameTimecode };
