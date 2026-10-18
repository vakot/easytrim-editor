import type { UnknownAction } from "@reduxjs/toolkit";

import { workspaceReducer } from "@/app/store/reducer";
import type { AppDispatch, RootState } from "@/app/store/store";
import type { AppThunk } from "@/app/store/thunks/source-media-thunks";

/** An unpublished reducer context, without subscriptions or effect/listener middleware. */
function createHistoryStage(initial: RootState) {
  let state = { ...initial };
  // Redux Persist's metadata belongs to the live store, not the unpublished reducer context.
  delete (state as RootState & { _persist?: unknown })._persist;
  const actions: UnknownAction[] = [];
  const getState = () => state;
  const dispatch = ((action: UnknownAction | AppThunk<unknown>): unknown => {
    if (typeof action === "function") return action(dispatch, getState);
    state = workspaceReducer(state, action);
    actions.push(action);
    return action;
  }) as AppDispatch;

  return { actions, dispatch, getState };
}

export { createHistoryStage };
