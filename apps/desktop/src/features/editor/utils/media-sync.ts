export function seekVideo(video: HTMLVideoElement | null, micros: number) {
  if (video) seekMediaIfNeeded(video, micros / 1_000_000);
}

export function seekMediaIfNeeded(media: HTMLMediaElement, seconds: number) {
  if (Math.abs(media.currentTime - seconds) <= 0.0005) return;
  try {
    media.currentTime = seconds;
  } catch {
    // Metadata may not be ready yet; loadedmetadata retries the seek.
  }
}

export function waitForSeekToSettle(media: HTMLMediaElement): Promise<void> {
  if (!media.seeking) return Promise.resolve();
  return new Promise((resolve) => {
    media.addEventListener("seeked", () => resolve(), { once: true });
  });
}

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
