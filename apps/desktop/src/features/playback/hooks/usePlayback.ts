import { useMemo, useSyncExternalStore } from "react";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectFrameIndex } from "@/app/store/slices/source-slice";
import {
  nearestBoundaryMicros,
  nextBoundaryMicros,
  previousBoundaryMicros,
} from "@/domain/frame-index";

import { usePlaybackController } from "../contexts/playback-context";

function usePlaybackSnapshot<Value>(
  select: (positionMicros: number, durationMicros: number, isPlaying: boolean) => Value,
) {
  const controller = usePlaybackController();
  const read = () => {
    const { durationMicros, positionMicros } = controller.getSnapshot();
    return select(positionMicros, durationMicros, controller.isPlaying);
  };

  return useSyncExternalStore(controller.subscribe, read, read);
}

function usePlaybackIsPlaying() {
  return usePlaybackSnapshot((_positionMicros, _durationMicros, isPlaying) => isPlaying);
}

/**
 * A value derived from the playback position. The component re-renders only when the derived
 * value changes, so a readout can follow the clock without rendering on every refresh.
 */
function usePlaybackPosition<Value>(select: (positionMicros: number) => Value) {
  return usePlaybackSnapshot((positionMicros) => select(positionMicros));
}

function usePlaybackActions() {
  const controller = usePlaybackController();
  return useMemo(
    () => ({
      /** Pauses and blocks playback until released; see `PlaybackController.hold`. */
      holdPlayback: controller.hold,
      pause: controller.pause,
      play: controller.play,
      seek: controller.seek,
      togglePlayback: controller.togglePlayback,
    }),
    [controller],
  );
}

/** Navigation over the source's frame boundaries, where every paused position rests. */
function useTimelinePlayback() {
  const index = useAppSelector(selectFrameIndex);
  const controller = usePlaybackController();

  return useMemo(() => {
    const position = () => controller.getSnapshot().positionMicros;
    return {
      durationMicros: index.endMicros,
      framesCount: index.count,
      /** The current position, read when an action needs it rather than on every refresh. */
      getPositionMicros: position,
      /** Moves to the frame boundary nearest `micros`. */
      seekTime: (micros: number) => controller.seek(nearestBoundaryMicros(index, micros)),
      stepFrame: (direction: -1 | 1) => {
        controller.pause();
        const from = position();
        controller.seek(
          direction > 0 ? nextBoundaryMicros(index, from) : previousBoundaryMicros(index, from),
        );
      },
    };
  }, [controller, index]);
}

export { usePlaybackActions, usePlaybackIsPlaying, usePlaybackPosition, useTimelinePlayback };
