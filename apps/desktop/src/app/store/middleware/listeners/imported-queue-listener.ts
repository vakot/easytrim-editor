import { importQueueItemActivationRequested } from "@/app/store/actions/imported-queue-actions";
import type { AppDispatch } from "@/app/store/store";
import { restoreActiveImportedItemRequested } from "@/app/store/thunks/source-media-thunks";

import { listenerMiddleware } from "../listener-middleware";

listenerMiddleware.startListening({
  actionCreator: importQueueItemActivationRequested,
  effect: (action, listenerApi) => {
    const dispatch = listenerApi.dispatch as unknown as AppDispatch;
    void dispatch(restoreActiveImportedItemRequested(action.payload.id));
  },
});
