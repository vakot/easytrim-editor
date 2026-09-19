import { isAnyOf } from "@reduxjs/toolkit";

import { setExportQueueExecutionEnabled } from "@/app/store/integration/export-queue-runtime";
import {
  editingInstanceExportAttemptQueued,
  editingInstanceExportCanceled,
  editingInstanceExportCompleted,
  editingInstanceExportFailed,
  editingInstanceExportRestored,
  selectHasQueuedOrRenderingExportByInstanceId,
} from "@/app/store/slices/editing-instances-slice";
import { selectAutoStartQueueEnabled } from "@/app/store/slices/preferences-slice";
import type { AppDispatch } from "@/app/store/store";
import { startSourceExportQueue } from "@/app/store/thunks/export-thunks";

import { listenerMiddleware } from "../listener-middleware";

listenerMiddleware.startListening({
  actionCreator: editingInstanceExportAttemptQueued,
  effect: (action, listenerApi) => {
    if (selectAutoStartQueueEnabled(listenerApi.getState())) {
      const dispatch = listenerApi.dispatch as unknown as AppDispatch;
      dispatch(startSourceExportQueue(action.payload.id));
    }
  },
});

const exportAttemptSettled = isAnyOf(
  editingInstanceExportCompleted,
  editingInstanceExportFailed,
  editingInstanceExportCanceled,
  editingInstanceExportRestored,
);

listenerMiddleware.startListening({
  matcher: exportAttemptSettled,
  effect: (action, listenerApi) => {
    if (!exportAttemptSettled(action)) return;
    if (!selectHasQueuedOrRenderingExportByInstanceId(listenerApi.getState(), action.payload.id)) {
      const dispatch = listenerApi.dispatch as unknown as AppDispatch;
      setExportQueueExecutionEnabled(false, dispatch, listenerApi.getState, action.payload.id);
    }
  },
});
