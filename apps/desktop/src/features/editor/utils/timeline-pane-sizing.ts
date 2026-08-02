export interface TimelinePanelSizeConstraints {
  minSize: number;
  defaultSize: number;
  maxSize: number;
}

// These values mirror the fixed CSS layout. The timeline and audio controls
// do not depend on media metadata, so constraints are available before render.
export const TIMELINE_FIXED_HEIGHT = 165; /* Fixed trim-timeline content height, in pixels. */
const TIMELINE_DIVIDER_HEIGHT = 1; /* Horizontal separator height between timeline and audio. */
const AUDIO_SECTION_TOP_PADDING = 16; /* Audio section `pt-4` padding. */
const AUDIO_SECTION_HEADING_HEIGHT = 16; /* Audio heading line-box height. */
const AUDIO_SECTION_GAP = 8; /* Vertical `gap-2` between audio section items. */
const AUDIO_MASTER_CONTROLS_HEIGHT = 36; /* Master controls row: 28px button plus 8px vertical padding. */
const AUDIO_TRACK_HEIGHT = 48; /* Fixed waveform row height from the `h-12` class. */
const AUDIO_SECTION_BOTTOM_PADDING = 16; /* Scroll content wrapper `pb-4` padding. */

export const AUDIO_SINGLE_TRACK_HEIGHT =
  AUDIO_SECTION_TOP_PADDING +
  AUDIO_SECTION_HEADING_HEIGHT +
  AUDIO_SECTION_GAP +
  AUDIO_MASTER_CONTROLS_HEIGHT +
  AUDIO_SECTION_GAP +
  AUDIO_TRACK_HEIGHT +
  AUDIO_SECTION_BOTTOM_PADDING;
export const AUDIO_TRACK_STEP =
  AUDIO_TRACK_HEIGHT + AUDIO_SECTION_GAP; /* Height added per additional track. */

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
