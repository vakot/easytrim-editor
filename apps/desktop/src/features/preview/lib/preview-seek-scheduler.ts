interface SeekRequest {
  approximate: boolean;
  onSettled?: () => void;
  seconds: number;
}

/** Coalesce rapid seeks per animation frame and retarget any seek already in flight. */
function createPreviewSeekScheduler(video: HTMLVideoElement) {
  let pending: SeekRequest | null = null;
  let active: SeekRequest | null = null;
  let approximatePosition = false;
  let hasAppliedSeek = false;
  let scheduledFrame: number | null = null;
  let disposed = false;

  function cancelScheduledPump() {
    if (scheduledFrame === null) return;
    cancelAnimationFrame(scheduledFrame);
    scheduledFrame = null;
  }

  function pump() {
    if (disposed || video.seeking || !pending) return;
    cancelScheduledPump();
    const request = pending;
    pending = null;
    active = request;
    try {
      if (
        !hasAppliedSeek ||
        Math.abs(video.currentTime - request.seconds) > 0.0005 ||
        approximatePosition
      ) {
        approximatePosition = request.approximate && typeof video.fastSeek === "function";
        if (approximatePosition) video.fastSeek(request.seconds);
        else video.currentTime = request.seconds;
        hasAppliedSeek = true;
      }
    } catch {
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

  function supersede(request: SeekRequest) {
    active = request;
    pending = null;
    try {
      const shouldUseApproximate = request.approximate && typeof video.fastSeek === "function";

      const needsSeek =
        !hasAppliedSeek ||
        Math.abs(video.currentTime - request.seconds) > 0.0005 ||
        approximatePosition ||
        shouldUseApproximate;

      approximatePosition = shouldUseApproximate;
      if (needsSeek) {
        if (approximatePosition) video.fastSeek(request.seconds);
        else video.currentTime = request.seconds;
        hasAppliedSeek = true;
      }
    } catch {
      pending = request;
    }
  }

  function scheduleLatestSeek() {
    if (disposed || scheduledFrame !== null) return;
    scheduledFrame = requestAnimationFrame(() => {
      scheduledFrame = null;
      if (!pending) return;
      const request = pending;
      pending = null;
      if (video.seeking && active) supersede(request);
      else {
        pending = request;
        pump();
      }
    });
  }

  function clear() {
    cancelScheduledPump();
    pending = null;
    active = null;
    approximatePosition = false;
    hasAppliedSeek = false;
  }

  video.addEventListener("seeked", settle);
  video.addEventListener("loadedmetadata", pump);
  video.addEventListener("error", clear);
  video.addEventListener("emptied", clear);

  return {
    get isPending() {
      return pending !== null || active !== null || video.seeking;
    },
    seek(seconds: number, approximate = false, onSettled?: () => void) {
      if (disposed || !Number.isFinite(seconds) || seconds < 0) return;
      const request = { seconds, approximate, onSettled };
      if (video.seeking && active) {
        pending = request;
        scheduleLatestSeek();
        return;
      }
      pending = request;
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

export { createPreviewSeekScheduler };
