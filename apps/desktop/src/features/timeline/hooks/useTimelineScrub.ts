import { type MutableRefObject, useCallback } from "react";

import type { TrimRange } from "@/domain/trim";
import { diagnostics } from "@/lib/diagnostics";

import type { FrameShuttleDirection } from "../lib/editor-shortcuts";
import { cancelFrame } from "../lib/playhead-sync";

interface TimelineScrubArgs {
  applyMediaSeek: (micros: number) => void;
  commitSeek: (micros: number, seekMedia?: boolean, publish?: boolean) => void;
  currentPlayheadMicrosRef: MutableRefObject<number>;
  flushFrameStepSeek: () => void;
  handleShuttleEnd: () => void;
  isPlayingRef: MutableRefObject<boolean>;
  lastScrubCommitAtRef: MutableRefObject<number>;
  pauseAudioPlayback: () => void;
  pauseMedia: () => void;
  pendingScrubMicrosRef: MutableRefObject<number | null>;
  playbackModes: {
    resetBoundary: () => void;
    startMicros: (
      currentMicros: number,
      trim: { endMicros: number; sourceDurationMicros: number; startMicros: number },
    ) => number;
  };
  playbackRequestedRef: MutableRefObject<boolean>;
  playbackStartSequenceRef: MutableRefObject<number>;
  resumeAfterScrubRef: MutableRefObject<boolean>;
  scrubFrameRef: MutableRefObject<number | null>;
  setIsPlaying: (playing: boolean) => void;
  shuttleDirectionRef: MutableRefObject<FrameShuttleDirection | 0>;
  startMediaPlayback: () => void;
  stopPlayheadAnimation: () => void;
  timelineInteractionActiveRef: MutableRefObject<boolean>;
  trimInteractionActiveRef: MutableRefObject<boolean>;
  trimRef: MutableRefObject<TrimRange>;
}

function useTimelineScrub({
  applyMediaSeek,
  commitSeek,
  currentPlayheadMicrosRef,
  flushFrameStepSeek,
  handleShuttleEnd,
  isPlayingRef,
  lastScrubCommitAtRef,
  pauseAudioPlayback,
  pauseMedia,
  pendingScrubMicrosRef,
  playbackModes,
  playbackRequestedRef,
  playbackStartSequenceRef,
  resumeAfterScrubRef,
  scrubFrameRef,
  setIsPlaying,
  shuttleDirectionRef,
  startMediaPlayback,
  stopPlayheadAnimation,
  timelineInteractionActiveRef,
  trimInteractionActiveRef,
  trimRef,
}: TimelineScrubArgs) {
  const queueScrubSeek = useCallback(
    (micros: number) => {
      pendingScrubMicrosRef.current = Math.max(
        0,
        Math.min(micros, trimRef.current.sourceDurationMicros),
      );
      if (scrubFrameRef.current !== null) return;
      scrubFrameRef.current = requestAnimationFrame((timestamp) => {
        scrubFrameRef.current = null;
        const pendingMicros = pendingScrubMicrosRef.current;
        pendingScrubMicrosRef.current = null;
        if (pendingMicros !== null) {
          const publish =
            trimInteractionActiveRef.current || timestamp - lastScrubCommitAtRef.current >= 100;

          if (publish) lastScrubCommitAtRef.current = timestamp;
          commitSeek(pendingMicros, true, publish);
        }
      });
    },
    [
      commitSeek,
      lastScrubCommitAtRef,
      pendingScrubMicrosRef,
      scrubFrameRef,
      trimInteractionActiveRef,
      trimRef,
    ],
  );

  const flushScrubSeek = useCallback(() => {
    cancelFrame(scrubFrameRef);
    const pendingMicros = pendingScrubMicrosRef.current;
    pendingScrubMicrosRef.current = null;
    commitSeek(pendingMicros ?? currentPlayheadMicrosRef.current, false);
  }, [commitSeek, currentPlayheadMicrosRef, pendingScrubMicrosRef, scrubFrameRef]);

  const startScrub = useCallback(() => {
    flushFrameStepSeek();
    if (shuttleDirectionRef.current !== 0) handleShuttleEnd();
    diagnostics.event("timeline.seek.started", {
      data: { source: "timeline" },
      origin: { type: "timeline", id: "timeline.scrub" },
    });
    timelineInteractionActiveRef.current = true;
    lastScrubCommitAtRef.current = -Infinity;
    playbackStartSequenceRef.current += 1;
    resumeAfterScrubRef.current = playbackRequestedRef.current || isPlayingRef.current;
    playbackRequestedRef.current = false;
    isPlayingRef.current = false;
    pauseMedia();
    pauseAudioPlayback();
    setIsPlaying(false);
    stopPlayheadAnimation();
  }, [
    flushFrameStepSeek,
    handleShuttleEnd,
    isPlayingRef,
    lastScrubCommitAtRef,
    pauseAudioPlayback,
    pauseMedia,
    playbackRequestedRef,
    playbackStartSequenceRef,
    resumeAfterScrubRef,
    shuttleDirectionRef,
    setIsPlaying,
    stopPlayheadAnimation,
    timelineInteractionActiveRef,
  ]);

  const endScrub = useCallback(() => {
    flushScrubSeek();
    diagnostics.event("timeline.seek.completed", {
      data: { micros: currentPlayheadMicrosRef.current },
      origin: { type: "timeline", id: "timeline.scrub" },
    });
    timelineInteractionActiveRef.current = false;
    trimInteractionActiveRef.current = false;
    if (resumeAfterScrubRef.current) {
      resumeAfterScrubRef.current = false;
      playbackModes.startMicros(currentPlayheadMicrosRef.current, trimRef.current);
      playbackModes.resetBoundary();
      startMediaPlayback();
    } else {
      applyMediaSeek(currentPlayheadMicrosRef.current);
    }
  }, [
    applyMediaSeek,
    currentPlayheadMicrosRef,
    flushScrubSeek,
    playbackModes,
    resumeAfterScrubRef,
    startMediaPlayback,
    timelineInteractionActiveRef,
    trimInteractionActiveRef,
    trimRef,
  ]);

  return { endScrub, queueScrubSeek, startScrub };
}

export { useTimelineScrub };
