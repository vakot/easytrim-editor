import { editingInstanceActivated } from "@/app/store/actions/editing-instance-actions";
import { createEditorSnapshotFromState } from "@/app/store/integration/editor-snapshot";
import { sourceReady } from "@/app/store/actions/source-actions";
import {
  cropChanged,
  rotationChanged,
  selectCropResolution,
} from "@/app/store/slices/crop-slice";
import {
  editingInstanceOptimizedSettingsChanged,
  editingInstanceSnapshotUpdated,
  selectActiveEditingInstance,
} from "@/app/store/slices/editing-instances-slice";

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
  actionCreator: cropChanged,
  effect: (action, listenerApi) => {
    const instance = selectActiveEditingInstance(listenerApi.getState());
    if (!instance) return;
    listenerApi.dispatch(
      editingInstanceOptimizedSettingsChanged({
        id: instance.id,
        settings: {
          frameRate: instance.optimizedSettings?.frameRate,
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
          resolution: selectCropResolution(listenerApi.getState()),
        },
      }),
    );
  },
});
