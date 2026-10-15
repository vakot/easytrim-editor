/** Horizontal position of `micros` on a timeline of `durationMicros`, as a percentage. */
function percentOf(micros: number, durationMicros: number) {
  if (durationMicros <= 0) return 0;
  return (Math.max(0, Math.min(durationMicros, micros)) / durationMicros) * 100;
}

/** The time under a pointer at `clientX` on a layer spanning `left` to `left + width`. */
function microsAtClientX(clientX: number, left: number, width: number, durationMicros: number) {
  if (width <= 0 || durationMicros <= 0) return 0;
  const fraction = Math.max(0, Math.min(1, (clientX - left) / width));
  return Math.round(fraction * durationMicros);
}

/** The target within `thresholdPixels` of `micros`, if any, preferring the nearest. */
function snapToTargets(
  micros: number,
  targets: readonly number[],
  {
    durationMicros,
    thresholdPixels,
    width,
  }: {
    durationMicros: number;
    thresholdPixels: number;
    width: number;
  },
) {
  if (width <= 0 || durationMicros <= 0) return micros;
  const threshold = (thresholdPixels / width) * durationMicros;
  let snapped = micros;
  let distance = threshold;
  for (const target of targets) {
    const gap = Math.abs(target - micros);
    if (gap <= distance) {
      distance = gap;
      snapped = target;
    }
  }
  return snapped;
}

export { microsAtClientX, percentOf, snapToTargets };
