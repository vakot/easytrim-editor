import { useAppSelector } from "@/app/store/redux-hooks";
import { selectExportQueue } from "@/app/store/slices/editing-instances-slice";

import { ExportQueueContext } from "./contexts/ExportQueueContext";

function ExportQueue({ children }: { children?: React.ReactNode }) {
  const queue = useAppSelector(selectExportQueue);
  return <ExportQueueContext.Provider value={{ queue }}>{children}</ExportQueueContext.Provider>;
}

export { ExportQueue };
