import { createAction } from "@reduxjs/toolkit";

export const importedQueueItemActivationRequested = createAction<{ id: string }>(
  "importedQueue/itemActivationRequested",
);
