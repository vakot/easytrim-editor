import { useMemo, useSyncExternalStore } from "react";

import type { FrameRate } from "@/domain/media";

import { usePlaybackController } from "../contexts/playback-context";
import { frameCountFor, frameToPlaybackMicros, microsToFrame } from "../lib/playback-time";

const DEFAULT_FRAME_RATE = { denominator: 1, numerator: 30 } as const;

function usePlaybackSnapshot<Value>(
  select: (
    positionMicros: number,
    durationMicros: number,
    isPlaying: boolean,
    isVideoMuted: boolean,
  ) => Value,
) {
  const controller = usePlaybackController();
  return useSyncExternalStore(
    controller.subscribe,
    () => {
      const { durationMicros, isPlaying, isVideoMuted, positionMicros } = controller.getSnapshot();
      return select(positionMicros, durationMicros, isPlaying, isVideoMuted);
    },
    () => {
      const { durationMicros, isPlaying, isVideoMuted, positionMicros } = controller.getSnapshot();
      return select(positionMicros, durationMicros, isPlaying, isVideoMuted);
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

function usePlaybackIsVideoMuted() {
  return usePlaybackSnapshot(
    (_positionMicros, _durationMicros, _isPlaying, isVideoMuted) => isVideoMuted,
  );
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

function useTimelinePlayback(
  frameRate: FrameRate | undefined,
  metadataFrameCount: number | undefined,
) {
  const positionMicros = usePlaybackPositionMicros();
  const durationMicros = usePlaybackDurationMicros();
  const framesCount =
    metadataFrameCount && metadataFrameCount > 0
      ? metadataFrameCount
      : frameCountFor(durationMicros, frameRate);

  const conversionFrameRate = frameRate ?? DEFAULT_FRAME_RATE;
  const currentFrame = microsToFrame(positionMicros, conversionFrameRate, framesCount);
  const { seek } = usePlaybackActions();

  return {
    currentFrame,
    framesCount,
    seekFrame: (frame: number) => {
      seek(frameToPlaybackMicros(frame, framesCount, durationMicros, conversionFrameRate));
    },
  };
}

export { usePlaybackActions, usePlaybackIsPlaying, usePlaybackIsVideoMuted, useTimelinePlayback };
