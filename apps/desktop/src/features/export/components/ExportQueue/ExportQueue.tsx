import { useAppSelector } from "@/app/store/redux-hooks";
import {
  selectExportQueue,
  selectExportQueueSummary,
} from "@/app/store/slices/editing-instances-slice";

import { ExportQueueContext } from "./contexts/ExportQueueContext";

function ExportQueue({ children }: { children?: React.ReactNode }) {
  const queue = useAppSelector(selectExportQueue);
  const summary = useAppSelector(selectExportQueueSummary);

  return (
    <ExportQueueContext.Provider value={{ queue, summary }}>{children}</ExportQueueContext.Provider>
  );
}

export { ExportQueue };
