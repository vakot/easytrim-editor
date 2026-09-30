import type { PreviewPlaybackFrame } from "../contexts/preview-runtime-context";

function requestPreviewPlaybackFrame(
  video: HTMLVideoElement,
  callback: (timestamp: number, mediaTimeSeconds: number) => void,
): PreviewPlaybackFrame {
  if (typeof video.requestVideoFrameCallback === "function") {
    const id = video.requestVideoFrameCallback((timestamp, metadata) => {
      callback(timestamp, metadata.mediaTime);
    });

    return { cancel: () => video.cancelVideoFrameCallback(id) };
  }
  const id = requestAnimationFrame((timestamp) => callback(timestamp, video.currentTime));
  return { cancel: () => cancelAnimationFrame(id) };
}

export { requestPreviewPlaybackFrame };
