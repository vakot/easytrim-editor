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
      disabled={controlsDisabled}
      frameRate={frameRate}
      onChange={timeline.onChange}
      onMoveSegment={timeline.onMoveSegment}
      onScrub={timeline.onScrub}
      onScrubEnd={timeline.onScrubEnd}
      onScrubStart={timeline.onScrubStart}
      onSeek={timeline.onSeek}
      onSegmentDragEnd={timeline.onSegmentDragEnd}
      onSegmentDragStart={timeline.onSegmentDragStart}
      onTrimDragEnd={timeline.onTrimDragEnd}
      onTrimDragStart={timeline.onTrimDragStart}
      playbackControls={
        <PlaybackControls
          canSetSegmentEnd={timeline.canSetSegmentEnd}
          canSetSegmentStart={timeline.canSetSegmentStart}
          disabled={controlsDisabled}
          error={playback.transportError}
          isPlaying={playback.isPlaying}
          onSetSegmentBoundary={playback.setSegmentBoundary}
          onStepFrame={playback.stepFrame}
          onTogglePlayback={playback.toggle}
        />
      }
      playbackTimecode={
        <PlaybackTimecode
          currentMicros={controlsDisabled ? null : timeline.playheadMicros}
          frameRate={frameRate}
          sourceDurationMicros={controlsDisabled ? null : timelineRange.sourceDurationMicros}
        />
      }
      playheadMicros={timeline.playheadMicros}
      playheadRef={timeline.playheadRef}
      range={timelineRange}
      videoToolbar={<TimelineTools />}
    />
  );
}
