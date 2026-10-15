import { useMemo, useSyncExternalStore } from "react";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectFrameIndex } from "@/app/store/slices/source-slice";
import { framePresentationMicros } from "@/domain/frame-index";

import { usePlaybackController } from "../contexts/playback-context";

function usePlaybackSnapshot<Value>(
  select: (positionMicros: number, durationMicros: number, isPlaying: boolean) => Value,
) {
  const controller = usePlaybackController();
  return useSyncExternalStore(
    controller.subscribe,
    () => {
      const { durationMicros, positionMicros } = controller.getSnapshot();
      return select(positionMicros, durationMicros, controller.isPlaying);
    },
    () => {
      const { durationMicros, positionMicros } = controller.getSnapshot();
      return select(positionMicros, durationMicros, controller.isPlaying);
    },
  );
}

function usePlaybackIsPlaying() {
  return usePlaybackSnapshot((_positionMicros, _durationMicros, isPlaying) => isPlaying);
}

function usePlaybackActions() {
  const controller = usePlaybackController();
  return useMemo(
    () => ({
      pause: controller.pause,
      play: controller.play,
      seek: controller.seek,
      togglePlayback: controller.togglePlayback,
    }),
    [controller],
  );
}

/** The Timeline's frames: the frame on screen, the frame count, and frame-addressed seeking. */
function useTimelinePlayback() {
  const index = useAppSelector(selectFrameIndex);
  // The Timeline is frame-addressed in every state: it follows the presented frame, not the clock,
  // and re-renders only when that frame changes.
  const currentFrame = usePlaybackSnapshot((positionMicros) => index.frameAt(positionMicros));
  const { seek } = usePlaybackActions();

  return {
    currentFrame,
    framesCount: index.count,
    /** Moves the playhead to a real frame; the end boundary is not a playhead position. */
    seekFrame: (frame: number) => {
      if (index.count === 0) return;
      const target = Math.max(0, Math.min(index.count - 1, Math.round(frame)));
      seek(index.startOf(target), framePresentationMicros(index, target));
    },
  };
}

export { usePlaybackActions, usePlaybackIsPlaying, useTimelinePlayback };
