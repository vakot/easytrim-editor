export function seekMediaIfNeeded(media: HTMLMediaElement, seconds: number) {
  if (Math.abs(media.currentTime - seconds) <= 0.0005) return;
  try {
    media.currentTime = seconds;
  } catch {
    // Metadata may not be ready yet; loadedmetadata retries the seek.
  }
}
