import { createContext, useContext } from "react";

import type { ExportQueueItem } from "@/app/store/slices/editing-instances-slice";

const ExportQueueContext = createContext<{ queue: ExportQueueItem[] } | null>(null);

function useExportQueue() {
  const context = useContext(ExportQueueContext);

  if (!context) {
    throw new Error(
      "ExportQueueContent, ExportQueueActions and ExportQueueList must be used within ExportQueue",
    );
  }

  return context;
}

export { ExportQueueContext, useExportQueue };
