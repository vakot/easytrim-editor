import "./listeners/export-queue-listener";

import { exportPresetPersistenceMiddleware } from "./export-preset-persistence-middleware";
import { listenerMiddleware } from "./listener-middleware";

export const appMiddleware = {
  prepend: [listenerMiddleware.middleware],
  append: [exportPresetPersistenceMiddleware],
} as const;
