export interface TimelinePanelSizeConstraints {
  minSize: number;
  defaultSize: number;
  maxSize: number;
}

// These values mirror the fixed CSS layout: the timeline and audio controls
// do not depend on media metadata, while each waveform row uses a fixed 56px
// row plus an 8px grid gap.
export const TIMELINE_FIXED_HEIGHT = 148;
export const AUDIO_SINGLE_TRACK_HEIGHT = 126;
export const AUDIO_TRACK_STEP = 64;

export function timelinePanelSizeConstraints(
  audioTrackCount: number,
): TimelinePanelSizeConstraints {
  const trackCount = Math.max(0, Math.floor(audioTrackCount));
  const audioContentHeight = trackCount
    ? AUDIO_SINGLE_TRACK_HEIGHT + (trackCount - 1) * AUDIO_TRACK_STEP
    : 0;
  const minSize = TIMELINE_FIXED_HEIGHT;
  const defaultSize = minSize + (trackCount ? AUDIO_SINGLE_TRACK_HEIGHT : 0);
  const maxSize = minSize + audioContentHeight;

  return {
    minSize,
    defaultSize,
    maxSize,
  };
}
