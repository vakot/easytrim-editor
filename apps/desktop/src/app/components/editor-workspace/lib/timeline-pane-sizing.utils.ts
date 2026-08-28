export interface TimelinePanelSizeConstraints {
  minSize: number;
  defaultSize: number;
  maxSize: number;
}

// These values mirror the fixed CSS layout. The timeline and audio controls
// do not depend on media metadata, so constraints are available before render.
const TIMELINE_FIXED_HEIGHT = 170; /* Fixed trim-timeline content height, in pixels. */
const TIMELINE_DIVIDER_HEIGHT = 1; /* Horizontal separator height between timeline and audio. */
const AUDIO_SECTION_TOP_PADDING = 16; /* Audio section `pt-4` padding. */
const AUDIO_SECTION_HEADING_HEIGHT = 16; /* Audio heading line-box height. */
const AUDIO_SECTION_GAP = 8; /* Vertical `gap-2` between audio section items. */
const AUDIO_MASTER_CONTROLS_HEIGHT = 36; /* Master controls row: 28px button plus 8px vertical padding. */
const AUDIO_TRACK_HEIGHT = 48; /* Fixed waveform row height from the `h-12` class. */
const AUDIO_SECTION_BOTTOM_PADDING = 16; /* Scroll content wrapper `pb-4` padding. */

const AUDIO_SINGLE_TRACK_HEIGHT =
  TIMELINE_DIVIDER_HEIGHT +
  AUDIO_SECTION_TOP_PADDING +
  AUDIO_SECTION_HEADING_HEIGHT +
  AUDIO_SECTION_GAP +
  AUDIO_MASTER_CONTROLS_HEIGHT +
  AUDIO_SECTION_GAP +
  AUDIO_TRACK_HEIGHT +
  AUDIO_SECTION_BOTTOM_PADDING;

const AUDIO_TRACK_STEP =
  AUDIO_TRACK_HEIGHT + AUDIO_SECTION_GAP; /* Height added per additional track. */

const getAudioContentHeight = (audioTrackCount: number): number => {
  const trackCount = Math.max(0, Math.floor(audioTrackCount));
  if (!trackCount) return 0;
  return AUDIO_SINGLE_TRACK_HEIGHT + (trackCount - 1) * AUDIO_TRACK_STEP;
};

export function timelinePanelSizeConstraints(
  audioTrackCount: number,
): TimelinePanelSizeConstraints {
  const trackCount = Math.max(0, Math.floor(audioTrackCount));
  const defaultSize = TIMELINE_FIXED_HEIGHT + (trackCount ? AUDIO_SINGLE_TRACK_HEIGHT : 0);
  const maxSize = TIMELINE_FIXED_HEIGHT + getAudioContentHeight(trackCount);

  return {
    minSize: TIMELINE_FIXED_HEIGHT,
    defaultSize,
    maxSize,
  };
}
