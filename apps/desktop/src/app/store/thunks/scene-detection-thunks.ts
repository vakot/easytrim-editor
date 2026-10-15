import {
  editingInstanceSceneDetectionChanged,
  selectActiveEditingInstance,
} from "@/app/store/slices/editing-instances-slice";
import {
  sceneDetectionFailed,
  sceneDetectionFinished,
  sceneDetectionStarted,
  selectSceneDetectionOperation,
  selectSceneDetectionStatus,
} from "@/app/store/slices/scene-detection-slice";
import {
  selectSourceLoadToken,
  selectSourceReady,
  selectSourceSelection,
} from "@/app/store/slices/source-slice";
import type { AppThunk } from "@/app/store/thunks/source-media-thunks";
import { detectScenes } from "@/lib/tauri/media";
import { normalizeAppError } from "@/lib/tauri/media.utils";

function detectActiveSourceScenes(): AppThunk<Promise<void>> {
  return async (dispatch, getState) => {
    const state = getState();
    const source = selectSourceSelection(state);
    const instance = selectActiveEditingInstance(state);
    const { status } = selectSceneDetectionStatus(state);
    if (!selectSourceReady(state) || !source || !instance) return;
    if (status === "unavailable" || status === "loading") return;

    const operationId = crypto.randomUUID();
    const loadToken = selectSourceLoadToken(state);
    const isCurrent = () => {
      const current = getState();
      return (
        selectSceneDetectionOperation(current)?.operationId === operationId &&
        selectSourceLoadToken(current) === loadToken &&
        selectActiveEditingInstance(current)?.id === instance.id
      );
    };

    dispatch(sceneDetectionStarted({ instanceId: instance.id, loadToken, operationId }));
    dispatch(
      editingInstanceSceneDetectionChanged({
        boundariesMicros: null,
        id: instance.id,
        sourcePath: source.sourcePath,
      }),
    );
    try {
      const boundariesMicros = await detectScenes(source.sourcePath);
      if (!isCurrent()) return;
      dispatch(
        editingInstanceSceneDetectionChanged({
          boundariesMicros,
          id: instance.id,
          sourcePath: source.sourcePath,
        }),
      );
      dispatch(sceneDetectionFinished({ operationId }));
    } catch (error: unknown) {
      if (!isCurrent()) return;
      dispatch(sceneDetectionFailed({ error: normalizeAppError(error), operationId }));
    }
  };
}

export { detectActiveSourceScenes };
