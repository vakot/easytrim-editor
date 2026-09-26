import {
  editingInstanceClosed,
  editingInstancesClosed,
} from "@/app/store/slices/editing-instances-slice";
import type { AppDispatch } from "@/app/store/store";
import { releaseImportedSourceThumbnailForInstance } from "@/app/store/thunks/source-media-thunks";

import { listenerMiddleware } from "../listener-middleware";

listenerMiddleware.startListening({
  actionCreator: editingInstanceClosed,
  effect: (action, { dispatch }) => {
    (dispatch as AppDispatch)(releaseImportedSourceThumbnailForInstance(action.payload));
  },
});

listenerMiddleware.startListening({
  actionCreator: editingInstancesClosed,
  effect: (action, { dispatch }) => {
    for (const instanceId of action.payload) {
      (dispatch as AppDispatch)(releaseImportedSourceThumbnailForInstance(instanceId));
    }
  },
});
