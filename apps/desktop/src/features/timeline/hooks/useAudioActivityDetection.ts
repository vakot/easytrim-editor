import { useCallback, useEffect, useMemo, useRef } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectAudioTracks,
  selectMasterAudio,
  selectMergeAudio,
} from "@/app/store/slices/audio-slice";
import { selectActiveEditingInstance } from "@/app/store/slices/editing-instances-slice";
import {
  audioActivityDetectionFailed,
  audioActivityDetectionFinished,
  audioActivityDetectionStarted,
  selectAudioActivityDetectionOperation,
} from "@/app/store/slices/editor-tools-slice";
import {
  selectSourceLoadToken,
  selectSourceMedia,
  selectSourceSelection,
} from "@/app/store/slices/source-slice";
import { selectedAudioTracks } from "@/domain/audio-export";
import { normalizeSourceKey } from "@/domain/source";
import { detectAudioActivity } from "@/lib/tauri/media";

function useAudioActivityDetection(enabled: boolean) {
  const dispatch = useAppDispatch();
  const source = useAppSelector(selectSourceSelection);
  const media = useAppSelector(selectSourceMedia);
  const loadToken = useAppSelector(selectSourceLoadToken);
  const activeInstance = useAppSelector(selectActiveEditingInstance);
  const audioTracks = useAppSelector(selectAudioTracks);
  const masterAudio = useAppSelector(selectMasterAudio);
  const mergeAudio = useAppSelector(selectMergeAudio);
  const operation = useAppSelector(selectAudioActivityDetectionOperation);
  const activeInstanceMatchesSource = Boolean(
    source &&
    activeInstance &&
    normalizeSourceKey(activeInstance.snapshot.source.sourcePath) ===
      normalizeSourceKey(source.sourcePath),
  );

  const sourceKey = source ? `${activeInstance?.id ?? ""}:${source.sourcePath}:${loadToken}` : null;
  const mix = useMemo(
    () => selectedAudioTracks(audioTracks, masterAudio),
    [audioTracks, masterAudio],
  );

  const mixKey = JSON.stringify({ mergeAudio, mix });
  const requestId = useRef(0);

  useEffect(() => {
    requestId.current += 1;
  }, [mixKey, sourceKey]);

  const detect = useCallback(async () => {
    if (
      !source ||
      !sourceKey ||
      !media ||
      !enabled ||
      !activeInstanceMatchesSource ||
      !activeInstance ||
      !mix.length
    )
      return;
    const currentRequestId = ++requestId.current;
    dispatch(audioActivityDetectionStarted({ mixKey, sourceKey }));
    try {
      const ranges = await detectAudioActivity(
        source.sourcePath,
        mix,
        mergeAudio,
        media.durationMicros,
      );

      if (requestId.current !== currentRequestId) return;
      dispatch(audioActivityDetectionFinished({ mixKey, ranges, sourceKey }));
    } catch (error: unknown) {
      if (requestId.current !== currentRequestId) return;
      dispatch(
        audioActivityDetectionFailed({
          error:
            error instanceof Error
              ? error.message
              : typeof error === "object" &&
                  error !== null &&
                  "message" in error &&
                  typeof error.message === "string"
                ? error.message
                : null,
          mixKey,
          sourceKey,
        }),
      );
    }
  }, [
    activeInstance,
    activeInstanceMatchesSource,
    dispatch,
    enabled,
    media,
    mix,
    mixKey,
    mergeAudio,
    source,
    sourceKey,
  ]);

  const currentOperation =
    operation?.sourceKey === sourceKey && operation.mixKey === mixKey ? operation : null;

  const hasDetected = currentOperation?.status === "ready";

  return {
    canDetect: enabled && source !== null && activeInstanceMatchesSource && mix.length > 0,
    detect,
    error: currentOperation?.status === "failed" ? currentOperation.error : null,
    hasDetected,
    isDetecting: currentOperation?.status === "loading",
    mixKey,
    ranges: hasDetected ? (currentOperation.ranges ?? []) : [],
  };
}

export { useAudioActivityDetection };
