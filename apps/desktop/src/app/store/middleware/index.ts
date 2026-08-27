import { exportPresetPersistenceMiddleware } from "./export-preset-persistence-middleware";
import { listenerMiddleware } from "./listener-middleware";
import "./listeners/panel-layout-listener";
import "./listeners/export-queue-listener";
import "./listeners/imported-queue-listener";

export const appMiddleware = {
  prepend: [listenerMiddleware.middleware],
  append: [exportPresetPersistenceMiddleware],
} as const;
