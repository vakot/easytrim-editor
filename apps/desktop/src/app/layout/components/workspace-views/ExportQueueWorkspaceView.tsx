import {
  ExportQueue,
  ExportQueueContent,
  ExportQueueList,
  ExportQueueStartButton,
  ExportQueueStripMetadataCheckbox,
  ExportQueueSummary,
} from "@/features/export/queue";

function ExportQueueWorkspaceView() {
  return (
    <ExportQueue>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col pb-3">
        <div className="w-full min-w-0 truncate border-b pb-2 text-xs text-muted-foreground">
          <ExportQueueSummary />
        </div>

        <ExportQueueContent className="-mx-2 **:data-[slot=scroll-area-viewport]:px-2">
          <ExportQueueList className="py-2" />
        </ExportQueueContent>

        <div className="flex flex-col gap-2 border-t pt-2">
          <ExportQueueStripMetadataCheckbox />
          <ExportQueueStartButton />
        </div>
      </div>
    </ExportQueue>
  );
}

export { ExportQueueWorkspaceView };
