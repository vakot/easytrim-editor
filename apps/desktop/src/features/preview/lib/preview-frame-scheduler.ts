import type { PreviewPlaybackFrame } from "../contexts/preview-runtime-context";

function requestPreviewPlaybackFrame(
  video: HTMLVideoElement,
  callback: (timestamp: number, mediaTimeSeconds: number) => void,
): PreviewPlaybackFrame {
  // Presented-frame timestamps can lead currentTime and stop before terminal EOF.
  // Sample the native transport clock for both running and paused UI positions.
  const id = requestAnimationFrame((timestamp) => callback(timestamp, video.currentTime));
  return { cancel: () => cancelAnimationFrame(id) };
}

export { requestPreviewPlaybackFrame };
