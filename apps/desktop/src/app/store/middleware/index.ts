import "./listeners/export-queue-listener";
import "./listeners/diagnostics-listener";
import "./listeners/editing-instance-sync-listener";
import "./listeners/loudness-analysis-listener";
import "./listeners/thumbnail-lifecycle-listener";
import "./listeners/usage-statistics-listener";
import "./listeners/onboarding-achievements-listener";

import { exportPresetPersistenceMiddleware } from "./export-preset-persistence-middleware";
import { listenerMiddleware } from "./listener-middleware";

export const appMiddleware = {
  prepend: [listenerMiddleware.middleware],
  append: [exportPresetPersistenceMiddleware],
} as const;
