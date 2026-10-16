import { editingInstanceExportCompleted } from "@/app/store/slices/editing-instances-slice";
import type { AppDispatch } from "@/app/store/store";
import { loadUsageStatistics } from "@/app/store/thunks/usage-statistics-thunks";

import { listenerMiddleware } from "../listener-middleware";

// The native export command records statistics before it reports success, so a refresh after
// each completion observes the new totals. Refreshing is idempotent; counting happens natively.
listenerMiddleware.startListening({
  actionCreator: editingInstanceExportCompleted,
  effect: (_action, { dispatch }) => {
    void (dispatch as AppDispatch)(loadUsageStatistics());
  },
});
