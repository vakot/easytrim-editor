import { useCallback, useEffect, useRef, useState } from "react";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceLoadToken, selectSourceSelection } from "@/app/store/slices/source-slice";
import { detectScenes } from "@/lib/tauri/media";

type DetectionState =
  | { boundariesMicros: number[]; error: null; sourceKey: string; status: "ready" }
  | {
      boundariesMicros: null;
      error: string | null;
      sourceKey: string;
      status: "failed" | "idle" | "loading";
    };

function useSceneDetection(enabled: boolean) {
  const source = useAppSelector(selectSourceSelection);
  const loadToken = useAppSelector(selectSourceLoadToken);
  const sourceKey = source ? `${source.sourcePath}:${loadToken}` : null;
  const requestId = useRef(0);
  const [state, setState] = useState<DetectionState | null>(null);

  useEffect(() => {
    requestId.current += 1;
  }, [sourceKey]);

  const detect = useCallback(async () => {
    if (!source || !sourceKey || !enabled) return;
    const currentRequestId = ++requestId.current;
    setState({ boundariesMicros: null, error: null, sourceKey, status: "loading" });
    try {
      const boundariesMicros = await detectScenes(source.sourcePath);
      if (requestId.current !== currentRequestId) return;
      setState({ boundariesMicros, error: null, sourceKey, status: "ready" });
    } catch (error: unknown) {
      if (requestId.current !== currentRequestId) return;
      setState({
        boundariesMicros: null,
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
  }, [enabled, source, sourceKey]);

  const currentState = state?.sourceKey === sourceKey ? state : null;
  return {
    boundariesMicros: currentState?.status === "ready" ? currentState.boundariesMicros : [],
    canDetect: enabled && source !== null,
    detect,
    error: currentState?.status === "failed" ? currentState.error : null,
    hasFailed: currentState?.status === "failed",
    hasDetected: currentState?.status === "ready",
    isDetecting: currentState?.status === "loading",
  };
}

export { useSceneDetection };
