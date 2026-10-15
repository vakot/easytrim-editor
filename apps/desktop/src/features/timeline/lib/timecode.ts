import type { FrameRate } from "@/domain/media";

const MICROS_PER_SECOND = 1_000_000;
const SLOT_TOLERANCE = 0.05;
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
  // Containers store timestamps rounded (MKV to whole milliseconds), so a frame start can sit a
  // little below its exact slot. Allow 5% of a frame so it still lands in its own slot.
  const totalSlots = Math.floor(
    (time * rate.numerator) / (MICROS_PER_SECOND * rate.denominator) + SLOT_TOLERANCE,
  );

  const slotsPerSecond = rate.numerator / rate.denominator;
  let wholeSeconds = Math.floor(time / MICROS_PER_SECOND);
  let slot = totalSlots - Math.ceil(wholeSeconds * slotsPerSecond - SLOT_TOLERANCE);
  if (slot >= Math.ceil(slotsPerSecond - SLOT_TOLERANCE)) {
    wholeSeconds += 1;
    slot = 0;
  }
  slot = Math.max(0, slot);

  const hours = Math.floor(wholeSeconds / 3_600);
  const minutes = Math.floor((wholeSeconds % 3_600) / 60);
  const seconds = wholeSeconds % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(slot)}f`;
}

export { formatTimecode };
