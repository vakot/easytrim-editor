import * as React from "react";

import type { ExportQueueItem } from "@/app/store/slices/editing-instances-slice";

const ExportQueueItemContext = React.createContext<ExportQueueItem | null>(null);

function useExportQueueItem() {
  const context = React.useContext(ExportQueueItemContext);
  if (!context) {
    throw new Error("useExportQueueItem must be used within an ExportQueueItem provider");
  }
  return context;
}

export { ExportQueueItemContext, useExportQueueItem };
