import { createAction, type UnknownAction } from "@reduxjs/toolkit";

/** Publish only the resolved destination. Nested reducer actions do not run live listeners. */
const workspaceHistoryTransitionCommitted = createAction<{
  actions: UnknownAction[];
  analysisChanged: boolean;
  sourceChanged: boolean;
}>("workspaceHistory/transitionCommitted");

export { workspaceHistoryTransitionCommitted };
