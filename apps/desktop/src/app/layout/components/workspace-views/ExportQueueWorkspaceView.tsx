import { ScrollArea } from "@/components/ui/scroll-area";

import {
  ExportQueue,
  ExportQueueContent,
  ExportQueueStartButton,
  ExportQueueSummary,
} from "@/features/export";

function ExportQueueWorkspaceView() {
  return (
    <ExportQueue>
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <ExportQueueSummary />
          <ExportQueueStartButton />
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <ExportQueueContent className="py-2" />
        </ScrollArea>
      </div>
    </ExportQueue>
  );
}

export { ExportQueueWorkspaceView };
