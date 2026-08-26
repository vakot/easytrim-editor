import type { AppDispatch } from "@/app/store/store";
import { importedQueueItemActivationRequested } from "@/app/store/actions/imported-queue-actions";
import { restoreActiveImportedItemRequested } from "@/app/store/thunks/source-media-thunks";

import { listenerMiddleware } from "../listener-middleware";

listenerMiddleware.startListening({
  actionCreator: importedQueueItemActivationRequested,
  effect: (action, listenerApi) => {
    const dispatch = listenerApi.dispatch as unknown as AppDispatch;
    void dispatch(restoreActiveImportedItemRequested(action.payload.id));
  },
});
