import { createAction } from "@reduxjs/toolkit";

export const importQueueItemActivationRequested = createAction<{ id: string }>(
  "importQueue/itemActivationRequested",
);
