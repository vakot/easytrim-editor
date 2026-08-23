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
const WEBCAM_SECTION_TOP_PADDING = 16; /* Fixed webcam section wrapper `pt-4` padding. */
const WEBCAM_SECTION_HEADING_HEIGHT = 16; /* Webcam heading line-box height. */
const WEBCAM_SECTION_GAP = 8; /* Vertical `gap-2` between webcam section items. */
const WEBCAM_MASTER_CONTROLS_HEIGHT = 36; /* Position row: 28px controls plus 8px padding. */
const WEBCAM_TOOLS_HEADING_HEIGHT = 16; /* Tools heading line-box height. */
const WEBCAM_TOOLS_HEIGHT = 60; /* Two 28px tool rows plus a 4px gap. */
const WEBCAM_SECTION_BOTTOM_PADDING = 16; /* Fixed webcam section wrapper `pb-4` padding. */

export const AUDIO_SINGLE_TRACK_HEIGHT =
  TIMELINE_DIVIDER_HEIGHT +
  AUDIO_SECTION_TOP_PADDING +
  AUDIO_SECTION_HEADING_HEIGHT +
  AUDIO_SECTION_GAP +
  AUDIO_MASTER_CONTROLS_HEIGHT +
  AUDIO_SECTION_GAP +
  AUDIO_TRACK_HEIGHT +
  AUDIO_SECTION_BOTTOM_PADDING;
export const AUDIO_TRACK_STEP =
  AUDIO_TRACK_HEIGHT + AUDIO_SECTION_GAP; /* Height added per additional track. */
export const WEBCAM_SECTION_HEIGHT =
  TIMELINE_DIVIDER_HEIGHT +
  WEBCAM_SECTION_TOP_PADDING +
  WEBCAM_SECTION_HEADING_HEIGHT +
  WEBCAM_SECTION_GAP +
  WEBCAM_MASTER_CONTROLS_HEIGHT +
  WEBCAM_SECTION_GAP +
  WEBCAM_TOOLS_HEADING_HEIGHT +
  WEBCAM_SECTION_GAP +
  WEBCAM_TOOLS_HEIGHT +
  WEBCAM_SECTION_BOTTOM_PADDING;

const getAudioContentHeight = (audioTrackCount: number): number => {
  const trackCount = Math.max(0, Math.floor(audioTrackCount));
  if (!trackCount) return 0;
  return AUDIO_SINGLE_TRACK_HEIGHT + (trackCount - 1) * AUDIO_TRACK_STEP;
};

export function timelinePanelSizeConstraints(
  audioTrackCount: number,
  hasWebcam = false,
): TimelinePanelSizeConstraints {
  const trackCount = Math.max(0, Math.floor(audioTrackCount));
  const fixedContentHeight = TIMELINE_FIXED_HEIGHT + (hasWebcam ? WEBCAM_SECTION_HEIGHT : 0);
  const defaultSize = fixedContentHeight + (trackCount ? AUDIO_SINGLE_TRACK_HEIGHT : 0);
  const maxSize = fixedContentHeight + getAudioContentHeight(trackCount);

  return {
    minSize: TIMELINE_FIXED_HEIGHT,
    defaultSize,
    maxSize,
  };
}
