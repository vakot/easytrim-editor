import type { PreviewPlaybackFrame } from "../contexts/preview-runtime-context";

function requestPreviewPlaybackFrame(callback: (timestamp: number) => void): PreviewPlaybackFrame {
  const id = requestAnimationFrame(callback);
  return { cancel: () => cancelAnimationFrame(id) };
}

export { requestPreviewPlaybackFrame };
