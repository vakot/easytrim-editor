import type { UnlistenFn } from "@tauri-apps/api/event";

import { sourceFailed } from "@/app/store/actions/source-actions";
import { dropListenerFailed, sourceDragChanged } from "@/app/store/slices/import-workflow-slice";
import type { AppDispatch } from "@/app/store/store";
import {
  checkMediaCapabilitiesRequested,
  ingestSources,
} from "@/app/store/thunks/source-media-thunks";
import { listenForSourceDrops } from "@/lib/tauri/media";
import { normalizeAppError } from "@/lib/tauri/media.utils";

/**
 * Starts the application-lifetime source/media integration once, outside React
 * effects. The returned cleanup is intentionally runtime-only; unlisten handles
 * never enter Redux state.
 */
export function startSourceMediaRuntime(dispatch: AppDispatch): () => void {
  let stopped = false;
  let unlisten: UnlistenFn | undefined;

  void dispatch(checkMediaCapabilitiesRequested());
  void listenForSourceDrops((event) => {
    if (stopped) return;

    if (event.status === "drag") {
      dispatch(sourceDragChanged(event.active));
      return;
    }

    dispatch(sourceDragChanged(false));
    if (event.status === "failed") {
      dispatch(dropListenerFailed(event.error));
      dispatch(sourceFailed({ error: event.error }));
      return;
    }

    void dispatch(ingestSources(event.sources));
  }).then(
    (stopListening) => {
      if (stopped) {
        stopListening();
      } else {
        unlisten = stopListening;
      }
    },
    (error: unknown) => {
      if (!stopped) {
        dispatch(dropListenerFailed(normalizeAppError(error)));
      }
    },
  );

  const stop = () => {
    if (stopped) return;
    stopped = true;
    unlisten?.();
    unlisten = undefined;
  };

  return stop;
}
