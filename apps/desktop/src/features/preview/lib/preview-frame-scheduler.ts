import type { PreviewPlaybackFrame } from "../contexts/preview-runtime-context";

const presentedSeconds = new WeakMap<HTMLVideoElement, number>();

/**
 * Records the media timestamp of each frame the element presents, so playback reports the frame
 * on screen rather than the transport clock, which can run ahead of or behind the picture.
 */
function trackPresentedFrames(video: HTMLVideoElement): () => void {
  if (typeof video.requestVideoFrameCallback !== "function") return () => undefined;
  let active = true;
  let handle = 0;
  const onFrame: VideoFrameRequestCallback = (_now, metadata) => {
    if (!active) return;
    presentedSeconds.set(video, metadata.mediaTime);
    handle = video.requestVideoFrameCallback(onFrame);
  };

  handle = video.requestVideoFrameCallback(onFrame);
  return () => {
    active = false;
    video.cancelVideoFrameCallback(handle);
    presentedSeconds.delete(video);
  };
}

/** A seek replaces the frame on screen; until the new frame is presented, use the clock. */
function forgetPresentedFrame(video: HTMLVideoElement) {
  presentedSeconds.delete(video);
}

/** The timestamp of the frame on screen, or the clock where frames are not reported. */
function presentedTimeSeconds(video: HTMLVideoElement) {
  return presentedSeconds.get(video) ?? video.currentTime;
}

function requestPreviewPlaybackFrame(
  video: HTMLVideoElement,
  callback: (timestamp: number, presentedTimeSeconds: number) => void,
): PreviewPlaybackFrame {
  const id = requestAnimationFrame((timestamp) => callback(timestamp, presentedTimeSeconds(video)));
  return { cancel: () => cancelAnimationFrame(id) };
}

export {
  forgetPresentedFrame,
  presentedTimeSeconds,
  requestPreviewPlaybackFrame,
  trackPresentedFrames,
};
