import { useCallback, useEffect, useRef, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  editingInstanceSceneDetectionChanged,
  selectActiveEditingInstance,
} from "@/app/store/slices/editing-instances-slice";
import { selectSourceLoadToken, selectSourceSelection } from "@/app/store/slices/source-slice";
import { normalizeSourceKey } from "@/domain/source";
import { detectScenes } from "@/lib/tauri/media";

type DetectionState =
  | { error: null; sourceKey: string; status: "loading" }
  | { error: string | null; sourceKey: string; status: "failed" };

function useSceneDetection(enabled: boolean) {
  const dispatch = useAppDispatch();
  const source = useAppSelector(selectSourceSelection);
  const loadToken = useAppSelector(selectSourceLoadToken);
  const activeInstance = useAppSelector(selectActiveEditingInstance);
  const activeInstanceMatchesSource = Boolean(
    source &&
      activeInstance &&
      normalizeSourceKey(activeInstance.snapshot.source.sourcePath) ===
        normalizeSourceKey(source.sourcePath),
  );

  const sourceKey = source
    ? `${activeInstance?.id ?? ""}:${source.sourcePath}:${loadToken}`
    : null;

  const requestId = useRef(0);
  const [state, setState] = useState<DetectionState | null>(null);

  useEffect(() => {
    requestId.current += 1;
  }, [sourceKey]);

  const detect = useCallback(async () => {
    if (!source || !sourceKey || !enabled || !activeInstanceMatchesSource || !activeInstance)
      return;
    const currentRequestId = ++requestId.current;
    setState({ error: null, sourceKey, status: "loading" });
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
      setState(null);
    } catch (error: unknown) {
      if (requestId.current !== currentRequestId) return;
      setState({
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
        status: "failed",
      });
    }
  }, [activeInstance, activeInstanceMatchesSource, dispatch, enabled, source, sourceKey]);

  const currentState = state?.sourceKey === sourceKey ? state : null;
  const sceneBoundariesMicros = activeInstanceMatchesSource
    ? activeInstance?.snapshot.sceneBoundariesMicros
    : undefined;

  return {
    boundariesMicros: sceneBoundariesMicros ?? [],
    canDetect: enabled && source !== null && activeInstanceMatchesSource,
    detect,
    error: currentState?.status === "failed" ? currentState.error : null,
    hasFailed: currentState?.status === "failed",
    hasDetected: sceneBoundariesMicros !== undefined,
    isDetecting: currentState?.status === "loading",
  };
}

export { useSceneDetection };
