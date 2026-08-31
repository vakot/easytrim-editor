import type { UnlistenFn } from "@tauri-apps/api/event";

import { sourceFailed } from "@/app/store/actions/source-actions";
import { dropListenerFailed, sourceDragChanged } from "@/app/store/slices/import-workflow-slice";
import type { AppDispatch } from "@/app/store/store";
import {
  checkMediaCapabilitiesRequested,
  ingestSources,
} from "@/app/store/thunks/source-media-thunks";
import { type DiagnosticOperation, diagnostics } from "@/lib/diagnostics";
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
  const importOperations = new Map<string, DiagnosticOperation>();

  void dispatch(checkMediaCapabilitiesRequested());
  void listenForSourceDrops(
    (event) => {
      if (stopped) return;

      if (event.status === "drag") {
        dispatch(sourceDragChanged(event.active));
        return;
      }

      dispatch(sourceDragChanged(false));
      if (event.status === "failed") {
        const operation = event.operationId ? importOperations.get(event.operationId) : undefined;
        if (operation && event.operationId) {
          importOperations.delete(event.operationId);
          operation.fail(event.error);
        }
        diagnostics.error("source.drop.failed", event.error, {
          origin: { id: "source.drop", type: "system" },
        });
        dispatch(dropListenerFailed(event.error));
        dispatch(sourceFailed({ error: event.error }));
        return;
      }

      const operation = event.operationId ? importOperations.get(event.operationId) : undefined;
      if (event.operationId) importOperations.delete(event.operationId);
      const input = "importResult" in event ? event.importResult : event.sources;
      void dispatch(ingestSources(input, { id: "source.drop", type: "button" }, operation));
    },
    () => {
      const operation = diagnostics.startOperation("source.import", {
        origin: { id: "source.drop", type: "button" },
      });

      importOperations.set(operation.operationId, operation);
      return operation.operationId;
    },
  ).then(
    (stopListening) => {
      if (stopped) {
        stopListening();
      } else {
        unlisten = stopListening;
      }
    },
    (error: unknown) => {
      if (!stopped) {
        diagnostics.error("source.drop.listener.failed", error, {
          origin: { id: "source.drop", type: "system" },
        });
        dispatch(dropListenerFailed(normalizeAppError(error)));
      }
    },
  );

  const stop = () => {
    if (stopped) return;
    stopped = true;
    for (const operation of importOperations.values()) {
      operation.cancel({ reason: "runtime_stopped" });
    }
    importOperations.clear();
    unlisten?.();
    unlisten = undefined;
  };

  return stop;
}
