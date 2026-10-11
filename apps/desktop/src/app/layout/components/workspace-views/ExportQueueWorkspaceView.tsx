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
        <span className="min-w-0 truncate px-2 text-muted-foreground">
          <ExportQueueSummary />
        </span>
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
