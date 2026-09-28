import { editingInstanceActivated } from "@/app/store/actions/editing-instance-actions";
import { sourceCleared, sourceReady } from "@/app/store/actions/source-actions";
import { createEditorSnapshotFromState } from "@/app/store/integration/editor-snapshot";
import { releaseQueuedExportEdit } from "@/app/store/integration/export-queue-runtime";
import { cropChanged, rotationChanged, selectCropResolution } from "@/app/store/slices/crop-slice";
import {
  editingInstanceOptimizedSettingsChanged,
  editingInstanceSnapshotUpdated,
  selectActiveEditingInstance,
} from "@/app/store/slices/editing-instances-slice";
import {
  optimizedExportDialogClosed,
  queueEditFinished,
  selectQueueEdit,
} from "@/app/store/slices/export-slice";
import type { AppDispatch } from "@/app/store/store";

import { listenerMiddleware } from "../listener-middleware";

listenerMiddleware.startListening({
  matcher: (
    action,
  ): action is ReturnType<typeof sourceReady> | ReturnType<typeof editingInstanceActivated> =>
    sourceReady.match(action) || editingInstanceActivated.match(action),
  effect: (_, listenerApi) => {
    const state = listenerApi.getState();
    const instance = selectActiveEditingInstance(state);
    const source = state.source.source;
    if (!instance || !source || !state.source.media) return;
    const snapshot = createEditorSnapshotFromState(state, source);
    if (!snapshot) return;
    listenerApi.dispatch(
      editingInstanceSnapshotUpdated({
        id: instance.id,
        media: state.source.media,
        snapshot,
      }),
    );
  },
});

listenerMiddleware.startListening({
  matcher: (
    action,
  ): action is ReturnType<typeof sourceCleared> | ReturnType<typeof editingInstanceActivated> =>
    sourceCleared.match(action) || editingInstanceActivated.match(action),
  effect: (action, listenerApi) => {
    const queueEdit = selectQueueEdit(listenerApi.getState());
    if (
      !queueEdit ||
      (editingInstanceActivated.match(action) && action.payload.id === queueEdit.instanceId)
    )
      return;
    listenerApi.dispatch(optimizedExportDialogClosed());
    listenerApi.dispatch(queueEditFinished());
    releaseQueuedExportEdit(
      queueEdit.attemptId,
      listenerApi.dispatch as AppDispatch,
      listenerApi.getState,
    );
  },
});

listenerMiddleware.startListening({
  actionCreator: cropChanged,
  effect: (action, listenerApi) => {
    const instance = selectActiveEditingInstance(listenerApi.getState());
    if (!instance) return;
    listenerApi.dispatch(
      editingInstanceOptimizedSettingsChanged({
        id: instance.id,
        settings: {
          frameRate: instance.optimizedSettings?.frameRate,
          loudnessPreset: instance.optimizedSettings?.loudnessPreset,
          resolution: action.payload.resolution,
        },
      }),
    );
  },
});

listenerMiddleware.startListening({
  actionCreator: rotationChanged,
  effect: (_action, listenerApi) => {
    const instance = selectActiveEditingInstance(listenerApi.getState());
    if (!instance) return;
    listenerApi.dispatch(
      editingInstanceOptimizedSettingsChanged({
        id: instance.id,
        settings: {
          frameRate: instance.optimizedSettings?.frameRate,
          loudnessPreset: instance.optimizedSettings?.loudnessPreset,
          resolution: selectCropResolution(listenerApi.getState()),
        },
      }),
    );
  },
});
