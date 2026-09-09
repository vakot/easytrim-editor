interface SeekRequest {
  approximate: boolean;
  onSettled?: () => void;
  seconds: number;
}

/** One decoder seek at a time, plus the latest requested destination. */
export function createSeekScheduler(video: HTMLVideoElement) {
  let pending: SeekRequest | null = null;
  let active: SeekRequest | null = null;
  let approximatePosition = false;
  let disposed = false;

  function pump() {
    if (disposed || video.seeking || !pending) return;
    const request = pending;
    pending = null;
    active = request;
    try {
      if (Math.abs(video.currentTime - request.seconds) > 0.0005 || approximatePosition) {
        approximatePosition = request.approximate && typeof video.fastSeek === "function";
        if (approximatePosition) video.fastSeek(request.seconds);
        else video.currentTime = request.seconds;
      }
    } catch {
      // Some engines reject seeks before metadata. Retry only the newest request on readiness.
      pending = request;
      active = null;
      return;
    }
    if (!video.seeking) settle();
  }

  function settle() {
    if (disposed || video.seeking) return;
    const completed = active;
    active = null;
    if (pending) pump();
    else completed?.onSettled?.();
  }

  function clear() {
    pending = null;
    active = null;
    approximatePosition = false;
  }

  video.addEventListener("seeked", settle);
  video.addEventListener("loadedmetadata", pump);
  video.addEventListener("error", clear);
  video.addEventListener("emptied", clear);

  return {
    video,
    get isPending() {
      return pending !== null || active !== null || video.seeking;
    },
    seek(seconds: number, approximate = false, onSettled?: () => void) {
      if (disposed || !Number.isFinite(seconds) || seconds < 0) return;
      pending = { seconds, approximate, onSettled };
      pump();
    },
    dispose() {
      disposed = true;
      clear();
      video.removeEventListener("seeked", settle);
      video.removeEventListener("loadedmetadata", pump);
      video.removeEventListener("error", clear);
      video.removeEventListener("emptied", clear);
    },
  };
}
