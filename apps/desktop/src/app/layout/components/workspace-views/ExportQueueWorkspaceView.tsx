import { ScrollArea } from "@/components/ui/scroll-area";

import {
  ExportQueue,
  ExportQueueContent,
  ExportQueueStartButton,
  ExportQueueStripMetadataCheckbox,
  ExportQueueSummary,
} from "@/features/export";

function ExportQueueWorkspaceView() {
  return (
    <ExportQueue>
      <div className="flex min-h-0 flex-1 flex-col pb-3">
        <div className="min-w-0 truncate border-b px-2 pb-1 text-muted-foreground">
          <ExportQueueSummary />
        </div>
        <ScrollArea className="-mx-2 min-h-0 flex-1 px-2">
          <ExportQueueContent className="py-2" />
        </ScrollArea>
        <div className="flex flex-col gap-2 border-t pt-2">
          <ExportQueueStripMetadataCheckbox />
          <ExportQueueStartButton />
        </div>
      </div>
    </ExportQueue>
  );
}

export { ExportQueueWorkspaceView };
