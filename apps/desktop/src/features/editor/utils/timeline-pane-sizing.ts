export interface TimelinePanelSizeConstraints {
  minSize: number;
  defaultSize: number;
  maxSize: number;
}

interface TimelinePaneMeasurements {
  timelineHeight: number;
  audioContentHeight: number;
  singleTrackAudioHeight: number | null;
}

export function timelinePanelSizeConstraints({
  timelineHeight,
  audioContentHeight,
  singleTrackAudioHeight,
}: TimelinePaneMeasurements): TimelinePanelSizeConstraints {
  const minSize = Math.ceil(Math.max(0, timelineHeight));
  const visibleAudioHeight = Math.min(
    Math.max(0, audioContentHeight),
    Math.max(0, singleTrackAudioHeight ?? audioContentHeight),
  );
  const defaultSize = Math.ceil(minSize + visibleAudioHeight);
  const maxSize = Math.ceil(minSize + Math.max(0, audioContentHeight));

  return {
    minSize,
    defaultSize: Math.min(defaultSize, maxSize),
    maxSize,
  };
}
