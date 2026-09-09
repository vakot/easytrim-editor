interface SampledPlaybackOptions {
  frameRate: number;
  isSeeking: () => boolean;
  onTime: (micros: number, now: number) => boolean;
  rate: number;
  seek: (micros: number, onSettled: () => void) => void;
  startMicros: number;
}

/** A wall clock drives time; decoder throughput only determines which frames are shown. */
export function startSampledPlayback(options: SampledPlaybackOptions) {
  const interval = 1_000 / Math.min(60, Math.max(1, options.frameRate || 60));
  let anchorAt = performance.now();
  let anchorMicros = options.startMicros;
  let position = anchorMicros;
  let lastTick = anchorAt;
  let nextSeekAt = anchorAt;
  let lastSampleSlot = -1;
  let stopped = false;
  let frame: number;

  function tick(now: number) {
    if (stopped) return;
    // Background tabs and suspended windows must not jump minutes ahead on return.
    if (document.hidden || now - lastTick > 250) {
      anchorAt = now;
      anchorMicros = position;
    }
    lastTick = now;
    position = Math.round(anchorMicros + (now - anchorAt) * options.rate * 1_000);
    const boundaryHandled = options.onTime(position, now);
    if (stopped) return;
    const sampleSlot = Math.floor((now - anchorAt) / interval);
    if (
      !document.hidden &&
      !boundaryHandled &&
      sampleSlot !== lastSampleSlot &&
      now >= nextSeekAt &&
      !options.isSeeking()
    ) {
      lastSampleSlot = sampleSlot;
      // Completion grants the next slot. No queue of skipped frames is retained.
      nextSeekAt = Infinity;
      options.seek(position, () => {
        if (stopped) return;
        const finishedAt = performance.now();
        // Continue immediately after the decoder settles. The single in-flight seek and
        // latest-frame coalescing already provide backpressure; adding an idle interval
        // would turn a slow seek into an even slower preview cadence.
        nextSeekAt = finishedAt;
      });
    }
    frame = requestAnimationFrame(tick);
  }

  frame = requestAnimationFrame(tick);
  return {
    rate: options.rate,
    get isRunning() {
      return !stopped;
    },
    seek(micros: number) {
      anchorAt = performance.now();
      anchorMicros = micros;
      position = micros;
      nextSeekAt = anchorAt;
      lastSampleSlot = -1;
    },
    stop() {
      stopped = true;
      cancelAnimationFrame(frame);
    },
  };
}
