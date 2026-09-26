import { createContext, useContext } from "react";

import type {
  ExportQueueItem,
  ExportQueueSummary,
} from "@/app/store/slices/editing-instances-slice";

const ExportQueueContext = createContext<{
  queue: ExportQueueItem[];
  summary: ExportQueueSummary;
} | null>(null);

function useExportQueue() {
  const context = useContext(ExportQueueContext);

  if (!context) {
    throw new Error(
      "ExportQueueContent, ExportQueueActions and ExportQueueSummary must be used within ExportQueue",
    );
  }

  return context;
}

export { ExportQueueContext, useExportQueue };
