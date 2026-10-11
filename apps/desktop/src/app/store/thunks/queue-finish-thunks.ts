import { queueFinishActionsAvailable } from "@/app/store/slices/export-slice";
import { availableQueueFinishActions } from "@/lib/tauri/queue";

import type { AppThunk } from "./source-media-thunks";

const loadQueueFinishActions = (): AppThunk => async (dispatch) => {
  try {
    const actions = await availableQueueFinishActions();
    dispatch(queueFinishActionsAvailable(actions.includes("nothing") ? actions : ["nothing"]));
  } catch {
    dispatch(queueFinishActionsAvailable(["exit", "nothing"]));
  }
};

export { loadQueueFinishActions };
