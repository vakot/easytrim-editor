import { useMemo, useSyncExternalStore } from "react";

import type { FrameRate } from "@/domain/media";

import { usePlaybackController } from "../contexts/playback-context";
import {
  frameCountFor,
  framePresentationMicros,
  frameToPlaybackMicros,
  playheadFrameAt,
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

function usePlaybackPositionMicros() {
  return usePlaybackSnapshot((positionMicros) => positionMicros);
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
  const positionMicros = usePlaybackPositionMicros();
  const durationMicros = usePlaybackDurationMicros();
  const conversionFrameRate = frameRate ?? DEFAULT_FRAME_RATE;
  // One grid derived from the playback clock's own duration and rate, so every frame maps to a
  // reachable time and the final frame ends exactly at EOF.
  const framesCount = frameCountFor(durationMicros, conversionFrameRate);

  const { seek } = usePlaybackActions();

  return {
    currentFrame: presentedFrameAt(
      positionMicros,
      framesCount,
      durationMicros,
      conversionFrameRate,
    ),
    framesCount,
    playheadFrame: playheadFrameAt(
      positionMicros,
      framesCount,
      durationMicros,
      conversionFrameRate,
    ),
    seekFrame: (frame: number) => {
      seek(
        frameToPlaybackMicros(frame, framesCount, durationMicros, conversionFrameRate),
        framePresentationMicros(frame, framesCount, durationMicros, conversionFrameRate),
      );
    },
  };
}

export { usePlaybackActions, usePlaybackIsPlaying, useTimelinePlayback };
