import { useCallback, useEffect, useMemo, useRef } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectAudioTracks } from "@/app/store/slices/audio-slice";
import { selectActiveEditingInstance } from "@/app/store/slices/editing-instances-slice";
import {
  selectSilenceDetectionOperation,
  silenceDetectionFailed,
  silenceDetectionFinished,
  silenceDetectionStarted,
} from "@/app/store/slices/editor-tools-slice";
import { selectSourceLoadToken, selectSourceSelection } from "@/app/store/slices/source-slice";
import { normalizeSourceKey } from "@/domain/source";
import { detectSilence } from "@/lib/tauri/media";

function useSilenceDetection(enabled: boolean) {
  const dispatch = useAppDispatch();
  const source = useAppSelector(selectSourceSelection);
  const loadToken = useAppSelector(selectSourceLoadToken);
  const activeInstance = useAppSelector(selectActiveEditingInstance);
  const audioTracks = useAppSelector(selectAudioTracks);
  const operation = useAppSelector(selectSilenceDetectionOperation);
  const activeInstanceMatchesSource = Boolean(
    source &&
    activeInstance &&
    normalizeSourceKey(activeInstance.snapshot.source.sourcePath) ===
      normalizeSourceKey(source.sourcePath),
  );

  const sourceKey = source ? `${activeInstance?.id ?? ""}:${source.sourcePath}:${loadToken}` : null;
  const mix = useMemo(
    () =>
      audioTracks
        .filter((track) => track.enabled && track.volumePercent > 0)
        .map(({ streamIndex, volumePercent }) => ({ streamIndex, volumePercent })),
    [audioTracks],
  );

  const mixKey = JSON.stringify(mix);
  const requestId = useRef(0);

  useEffect(() => {
    requestId.current += 1;
  }, [mixKey, sourceKey]);

  const detect = useCallback(async () => {
    if (
      !source ||
      !sourceKey ||
      !enabled ||
      !activeInstanceMatchesSource ||
      !activeInstance ||
      !mix.length
    )
      return;
    const currentRequestId = ++requestId.current;
    dispatch(silenceDetectionStarted({ mixKey, sourceKey }));
    try {
      const ranges = await detectSilence(source.sourcePath, mix);
      if (requestId.current !== currentRequestId) return;
      dispatch(silenceDetectionFinished({ mixKey, ranges, sourceKey }));
    } catch (error: unknown) {
      if (requestId.current !== currentRequestId) return;
      dispatch(
        silenceDetectionFailed({
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
    mix,
    mixKey,
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

export { useSilenceDetection };
