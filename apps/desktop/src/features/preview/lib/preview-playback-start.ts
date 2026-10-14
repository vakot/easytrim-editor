async function startPreviewPlayback(video: HTMLVideoElement): Promise<number> {
  await video.play();
  if (video.paused && !video.ended) throw new Error("Video playback was cancelled.");
  if (video.ended) return video.duration;
  if (typeof video.requestVideoFrameCallback !== "function") return video.currentTime;

  // The first presented frame supplies a stable media/performance-time pair.
  // Native currentTime can rebase while the media output device starts.
  return await new Promise<number>((resolve, reject) => {
    const cleanup = () => {
      video.cancelVideoFrameCallback(frame);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onError);
      video.removeEventListener("emptied", onError);
    };

    const onPause = () => {
      if (!video.paused) return;
      if (video.ended) onEnded();
      else onError();
    };

    const onEnded = () => {
      cleanup();
      resolve(video.duration);
    };

    const onError = () => {
      cleanup();
      reject(new Error("Video presentation was interrupted."));
    };

    const frame = video.requestVideoFrameCallback((_time, metadata) => {
      cleanup();
      resolve(
        Math.max(
          0,
          metadata.mediaTime + (performance.now() - metadata.expectedDisplayTime) / 1_000,
        ),
      );
    });

    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onError);
    video.addEventListener("emptied", onError);
  });
}

export { startPreviewPlayback };
