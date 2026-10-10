import {
  SourceList,
  SourceListCloseAll,
  SourceListContent,
  SourceListSearch,
} from "@/features/source";

function SourcesWorkspaceView() {
  return (
    <SourceList>
      <div className="mt-1 flex min-h-0 flex-1 flex-col">
        <div className="flex gap-2">
          <SourceListSearch />
          <SourceListCloseAll />
        </div>
        <SourceListContent />
      </div>
    </SourceList>
  );
}

export { SourcesWorkspaceView };
