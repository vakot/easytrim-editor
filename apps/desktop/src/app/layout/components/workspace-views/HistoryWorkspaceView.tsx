import { useAppSelector } from "@/app/store/redux-hooks";
import { WorkspaceHistory, WorkspaceHistoryNavigation } from "@/features/history";

function HistoryWorkspaceView() {
  const operations = useAppSelector((state) => state.workspaceHistory.operations);
  const position = useAppSelector((state) => state.workspaceHistory.position);

  return (
    <div className="flex size-full min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2">
        <WorkspaceHistoryNavigation />
        <span className="truncate text-muted-foreground">
          {position}/{operations.length}
        </span>
      </div>
      <WorkspaceHistory />
    </div>
  );
}

export { HistoryWorkspaceView };
