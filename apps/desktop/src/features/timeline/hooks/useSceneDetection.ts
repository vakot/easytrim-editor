import { useCallback, useEffect, useRef } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  editingInstanceSceneDetectionChanged,
  selectActiveEditingInstance,
} from "@/app/store/slices/editing-instances-slice";
import {
  sceneDetectionFailed,
  sceneDetectionFinished,
  sceneDetectionStarted,
  selectSceneDetectionOperation,
} from "@/app/store/slices/editor-tools-slice";
import { selectSourceLoadToken, selectSourceSelection } from "@/app/store/slices/source-slice";
import { normalizeSourceKey } from "@/domain/source";
import { detectScenes } from "@/lib/tauri/media";

function useSceneDetection(enabled: boolean) {
  const dispatch = useAppDispatch();
  const source = useAppSelector(selectSourceSelection);
  const loadToken = useAppSelector(selectSourceLoadToken);
  const activeInstance = useAppSelector(selectActiveEditingInstance);
  const operation = useAppSelector(selectSceneDetectionOperation);
  const activeInstanceMatchesSource = Boolean(
    source &&
    activeInstance &&
    normalizeSourceKey(activeInstance.snapshot.source.sourcePath) ===
      normalizeSourceKey(source.sourcePath),
  );

  const sourceKey = source ? `${activeInstance?.id ?? ""}:${source.sourcePath}:${loadToken}` : null;

  const requestId = useRef(0);

  useEffect(() => {
    requestId.current += 1;
  }, [sourceKey]);

  const detect = useCallback(async () => {
    if (!source || !sourceKey || !enabled || !activeInstanceMatchesSource || !activeInstance)
      return;
    const currentRequestId = ++requestId.current;
    dispatch(sceneDetectionStarted(sourceKey));
    dispatch(
      editingInstanceSceneDetectionChanged({
        boundariesMicros: null,
        id: activeInstance.id,
        sourcePath: source.sourcePath,
      }),
    );
    try {
      const boundariesMicros = await detectScenes(source.sourcePath);
      if (requestId.current !== currentRequestId) return;
      dispatch(
        editingInstanceSceneDetectionChanged({
          boundariesMicros,
          id: activeInstance.id,
          sourcePath: source.sourcePath,
        }),
      );
      dispatch(sceneDetectionFinished(sourceKey));
    } catch (error: unknown) {
      if (requestId.current !== currentRequestId) return;
      dispatch(
        sceneDetectionFailed({
          error:
            error instanceof Error
              ? error.message
              : typeof error === "object" &&
                  error !== null &&
                  "message" in error &&
                  typeof error.message === "string"
                ? error.message
                : null,
          sourceKey,
        }),
      );
    }
  }, [activeInstance, activeInstanceMatchesSource, dispatch, enabled, source, sourceKey]);

  const currentOperation = operation?.sourceKey === sourceKey ? operation : null;
  const sceneBoundariesMicros = activeInstanceMatchesSource
    ? activeInstance?.snapshot.sceneBoundariesMicros
    : undefined;

  return {
    boundariesMicros: sceneBoundariesMicros ?? [],
    canDetect: enabled && source !== null && activeInstanceMatchesSource,
    detect,
    error: currentOperation?.status === "failed" ? currentOperation.error : null,
    hasFailed: currentOperation?.status === "failed",
    hasDetected: sceneBoundariesMicros !== undefined,
    isDetecting: currentOperation?.status === "loading",
  };
}

export { useSceneDetection };
