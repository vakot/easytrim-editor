import { isAnyOf } from "@reduxjs/toolkit";

import {
  exportCanceled,
  exportCompleted,
  exportFailed,
  queueEntryAdded,
  selectHasProcessableExports,
} from "@/app/store/slices/export-slice";
import { selectAutoStartQueueEnabled } from "@/app/store/slices/preferences-slice";
import type { AppDispatch } from "@/app/store/store";
import { pauseExportQueue, startExportQueue } from "@/app/store/thunks/export-thunks";

import { listenerMiddleware } from "../listener-middleware";

listenerMiddleware.startListening({
  actionCreator: queueEntryAdded,
  effect: (_, listenerApi) => {
    if (selectAutoStartQueueEnabled(listenerApi.getState())) {
      const dispatch = listenerApi.dispatch as unknown as AppDispatch;
      dispatch(startExportQueue());
    }
  },
});

listenerMiddleware.startListening({
  matcher: isAnyOf(exportCompleted, exportFailed, exportCanceled),
  effect: (_, listenerApi) => {
    if (!selectHasProcessableExports(listenerApi.getState())) {
      const dispatch = listenerApi.dispatch as unknown as AppDispatch;
      dispatch(pauseExportQueue());
    }
  },
});
