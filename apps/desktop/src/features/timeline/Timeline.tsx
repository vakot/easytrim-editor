import { usePlayback } from "@/app/hooks/usePlayback";
import { useTimeline } from "@/app/hooks/useTimeline";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceMedia, selectSourceReady } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";

import { PlaybackControls } from "./components/PlaybackControls";
import { PlaybackTimecode } from "./components/PlaybackTimecode";
import { TimelineTools } from "./components/TimelineTools";
import { TrimTimeline } from "./components/TrimTimeline";

const EMPTY_TIMELINE_RANGE = {
  startMicros: 0,
  endMicros: 1_000_000,
  sourceDurationMicros: 1_000_000,
} as const;

export function Timeline() {
  const media = useAppSelector(selectSourceMedia);
  const trim = useAppSelector(selectTrim);
  const isSourceReady = useAppSelector(selectSourceReady);
  const playback = usePlayback();
  const timeline = useTimeline();
  const timelineRange = trim ?? EMPTY_TIMELINE_RANGE;
  const controlsDisabled = !isSourceReady || !playback.isReady;
  const frameRate = media?.video.averageFrameRate ?? media?.video.realFrameRate;

  return (
    <TrimTimeline
      range={timelineRange}
      disabled={controlsDisabled}
      playheadMicros={timeline.playheadMicros}
      playheadRef={timeline.playheadRef}
      frameRate={frameRate}
      playbackControls={
        <PlaybackControls
          isPlaying={playback.isPlaying}
          error={playback.transportError}
          canSetSegmentStart={timeline.canSetSegmentStart}
          canSetSegmentEnd={timeline.canSetSegmentEnd}
          disabled={controlsDisabled}
          onTogglePlayback={playback.toggle}
          onStepFrame={playback.stepFrame}
          onSetSegmentBoundary={playback.setSegmentBoundary}
        />
      }
      playbackTimecode={
        <PlaybackTimecode
          currentMicros={controlsDisabled ? null : timeline.playheadMicros}
          sourceDurationMicros={controlsDisabled ? null : timelineRange.sourceDurationMicros}
          frameRate={frameRate}
        />
      }
      videoToolbar={<TimelineTools />}
      onChange={timeline.onChange}
      onMoveSegment={timeline.onMoveSegment}
      onTrimDragStart={timeline.onTrimDragStart}
      onTrimDragEnd={timeline.onTrimDragEnd}
      onSegmentDragStart={timeline.onSegmentDragStart}
      onSegmentDragEnd={timeline.onSegmentDragEnd}
      onSeek={timeline.onSeek}
      onScrubStart={timeline.onScrubStart}
      onScrub={timeline.onScrub}
      onScrubEnd={timeline.onScrubEnd}
    />
  );
}
