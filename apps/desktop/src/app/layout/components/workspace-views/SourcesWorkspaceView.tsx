import {
  SourceList,
  SourceListCloseAll,
  SourceListContent,
  SourceListNavigation,
  SourceListSearch,
} from "@/features/source/source-list";

function SourcesWorkspaceView() {
  return (
    <SourceList>
      <div className="mt-1 flex min-h-0 flex-1 flex-col">
        <div className="flex gap-1">
          <SourceListSearch />
          <SourceListNavigation />
          <SourceListCloseAll />
        </div>
        <SourceListContent className="-mx-2 **:data-[slot=scroll-area-viewport]:px-2" />
      </div>
    </SourceList>
  );
}

export { SourcesWorkspaceView };
