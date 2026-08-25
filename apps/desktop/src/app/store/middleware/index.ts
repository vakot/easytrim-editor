import { exportPresetPersistenceMiddleware } from "./export-preset-persistence-middleware";
import { listenerMiddleware } from "./listener-middleware";
import "./listeners/export-queue-listener";

export const appMiddleware = {
  prepend: [listenerMiddleware.middleware],
  append: [exportPresetPersistenceMiddleware],
} as const;
