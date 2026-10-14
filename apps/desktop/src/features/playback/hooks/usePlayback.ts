import { useMemo, useSyncExternalStore } from "react";

import type { FrameRate } from "@/domain/media";

import { usePlaybackController } from "../contexts/playback-context";
import {
  frameCountFor,
  framePresentationMicros,
  frameToPlaybackMicros,
  presentedFrameAt,
} from "../lib/playback-time";

const DEFAULT_FRAME_RATE = { denominator: 1, numerator: 30 } as const;

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

function usePlaybackDurationMicros() {
  return usePlaybackSnapshot((_positionMicros, durationMicros) => durationMicros);
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

function useTimelinePlayback(frameRate: FrameRate | undefined) {
  const durationMicros = usePlaybackDurationMicros();
  const conversionFrameRate = frameRate ?? DEFAULT_FRAME_RATE;
  // One grid derived from the playback clock's own duration and rate, so every frame maps to a
  // reachable time and the final frame ends exactly at EOF.
  const framesCount = frameCountFor(durationMicros, conversionFrameRate);
  // The Timeline is frame-addressed in every state: it follows the presented frame, not the clock,
  // and re-renders only when that frame changes.
  const currentFrame = usePlaybackSnapshot((positionMicros) =>
    presentedFrameAt(positionMicros, framesCount, durationMicros, conversionFrameRate),
  );

  const { seek } = usePlaybackActions();

  return {
    currentFrame,
    framesCount,
    seekFrame: (frame: number) => {
      seek(
        frameToPlaybackMicros(frame, framesCount, durationMicros, conversionFrameRate),
        framePresentationMicros(frame, framesCount, durationMicros, conversionFrameRate),
      );
    },
  };
}

export { usePlaybackActions, usePlaybackIsPlaying, useTimelinePlayback };
