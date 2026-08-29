import { seekMediaIfNeeded } from "@/lib/media-element.utils";

export type PlaybackFrameHandle =
  { id: number; kind: "video"; video: HTMLVideoElement } | { id: number; kind: "animation" };

export function seekVideo(video: HTMLVideoElement | null, micros: number) {
  if (video) seekMediaIfNeeded(video, micros / 1_000_000);
}

export function requestPlaybackFrame(
  video: HTMLVideoElement,
  callback: (now: number, mediaTimeSeconds: number) => void,
): PlaybackFrameHandle {
  if (typeof video.requestVideoFrameCallback === "function") {
    const id = video.requestVideoFrameCallback((now, metadata) => {
      callback(now, metadata.mediaTime);
    });

    return { kind: "video", id, video };
  }

  const id = requestAnimationFrame((now) => callback(now, video.currentTime));
  return { kind: "animation", id };
}

export function cancelPlaybackFrame(frameRef: { current: PlaybackFrameHandle | null }) {
  const handle = frameRef.current;
  if (!handle) return;
  if (handle.kind === "video") handle.video.cancelVideoFrameCallback(handle.id);
  else cancelAnimationFrame(handle.id);
  frameRef.current = null;
}
