import type { FrameRate } from "@/domain/media";

const MICROS_PER_SECOND = 1_000_000;
const FALLBACK_FRAME_RATE: FrameRate = { denominator: 1, numerator: 30 };

/**
 * Formats a media time as `HH:MM:SS:FFf`. The clock fields come straight from the time, and FF is
 * the frame slot that time falls in within its second at the stream's frame rate, so a timestamp
 * reported by FFprobe is shown as it is rather than renumbered.
 */
function formatTimecode(micros: number, frameRate: FrameRate | undefined) {
  const rate =
    frameRate && frameRate.numerator > 0 && frameRate.denominator > 0
      ? frameRate
      : FALLBACK_FRAME_RATE;

  const time = Math.max(0, Math.round(Number.isFinite(micros) ? micros : 0));
  const wholeSeconds = Math.floor(time / MICROS_PER_SECOND);
  const fraction = time - wholeSeconds * MICROS_PER_SECOND;
  // A tiny allowance keeps timestamps on a rate's rational grid from rounding down a slot.
  const slot = Math.floor(
    (fraction * rate.numerator) / (MICROS_PER_SECOND * rate.denominator) + 1e-6,
  );

  const hours = Math.floor(wholeSeconds / 3_600);
  const minutes = Math.floor((wholeSeconds % 3_600) / 60);
  const seconds = wholeSeconds % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(slot)}f`;
}

export { formatTimecode };
