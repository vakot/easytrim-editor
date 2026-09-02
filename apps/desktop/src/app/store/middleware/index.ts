import "./listeners/export-queue-listener";
import "./listeners/diagnostics-listener";
import "./listeners/editing-instance-sync-listener";

import { exportPresetPersistenceMiddleware } from "./export-preset-persistence-middleware";
import { listenerMiddleware } from "./listener-middleware";

export const appMiddleware = {
  prepend: [listenerMiddleware.middleware],
  append: [exportPresetPersistenceMiddleware],
} as const;
