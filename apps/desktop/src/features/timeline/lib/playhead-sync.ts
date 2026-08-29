export function syncPlayheadElements(
  playhead: HTMLButtonElement | null,
  audioPlayhead: HTMLDivElement | null,
  micros: number,
  durationMicros: number,
) {
  const percent = durationMicros > 0 ? (micros / durationMicros) * 100 : 0;
  if (playhead) {
    playhead.style.left = `${percent}%`;
    playhead.setAttribute("aria-valuenow", micros.toString());
    playhead.setAttribute("aria-valuetext", `${(micros / 1_000_000).toFixed(3)} seconds`);
  }
  if (audioPlayhead) audioPlayhead.style.left = `${percent}%`;
}

export function cancelFrame(frameRef: { current: number | null }) {
  if (frameRef.current !== null) {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }
}
