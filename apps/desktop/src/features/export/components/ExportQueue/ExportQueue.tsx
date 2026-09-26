import { useAppSelector } from "@/app/store/redux-hooks";
import { selectExportQueue } from "@/app/store/slices/editing-instances-slice";

import { ExportQueueEmpty } from "./components/ExportQueueEmpty";
import { ExportQueueContext } from "./contexts/ExportQueueContext";

function ExportQueue({ children }: { children?: React.ReactNode }) {
  const queue = useAppSelector(selectExportQueue);
  if (!queue.length) return <ExportQueueEmpty />;
  return <ExportQueueContext.Provider value={{ queue }}>{children}</ExportQueueContext.Provider>;
}

export { ExportQueue };
