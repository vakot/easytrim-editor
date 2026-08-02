export interface TimelinePanelSizeConstraints {
  minSize: number;
  defaultSize: number;
  maxSize: number;
}

// These values mirror the fixed CSS layout. The timeline and audio controls
// do not depend on media metadata, so constraints are available before render.
export const TIMELINE_FIXED_HEIGHT = 148;
const TIMELINE_DIVIDER_HEIGHT = 1;
const AUDIO_SECTION_TOP_PADDING = 16;
const AUDIO_SECTION_HEADING_HEIGHT = 16;
const AUDIO_SECTION_GAP = 8;
const AUDIO_MASTER_CONTROLS_HEIGHT = 36;
const AUDIO_TRACK_HEIGHT = 48;
const AUDIO_SECTION_BOTTOM_PADDING = 20;

export const AUDIO_SINGLE_TRACK_HEIGHT =
  AUDIO_SECTION_TOP_PADDING +
  AUDIO_SECTION_HEADING_HEIGHT +
  AUDIO_SECTION_GAP +
  AUDIO_MASTER_CONTROLS_HEIGHT +
  AUDIO_SECTION_GAP +
  AUDIO_TRACK_HEIGHT +
  AUDIO_SECTION_BOTTOM_PADDING;
export const AUDIO_TRACK_STEP = AUDIO_TRACK_HEIGHT + AUDIO_SECTION_GAP;

export function timelinePanelSizeConstraints(
  audioTrackCount: number,
): TimelinePanelSizeConstraints {
  const trackCount = Math.max(0, Math.floor(audioTrackCount));
  const audioContentHeight = trackCount
    ? AUDIO_SINGLE_TRACK_HEIGHT + (trackCount - 1) * AUDIO_TRACK_STEP
    : 0;
  const minSize = TIMELINE_FIXED_HEIGHT + (trackCount ? TIMELINE_DIVIDER_HEIGHT : 0);
  const defaultSize = minSize + (trackCount ? AUDIO_SINGLE_TRACK_HEIGHT : 0);
  const maxSize = minSize + audioContentHeight;

  return {
    minSize,
    defaultSize,
    maxSize,
  };
}
