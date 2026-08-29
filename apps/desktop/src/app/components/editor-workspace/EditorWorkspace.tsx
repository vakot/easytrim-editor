import { useTranslation } from "react-i18next";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectActiveItemId } from "@/app/store/slices/export-slice";
import { selectSourceSelection } from "@/app/store/slices/source-slice";
import { SourcePanel } from "@/features/source";

import { EditorStage } from "./EditorStage";

export function EditorWorkspace() {
  const { t } = useTranslation();

  const sourceSelection = useAppSelector(selectSourceSelection);
  const activeItemId = useAppSelector(selectActiveItemId);

  return (
    <ResizablePanelGroup className="pr-2 pl-1" id="workspace" persisted>
      <ResizablePanel
        className="overflow-hidden pb-1 pl-1"
        collapsedSize={0}
        collapsible
        defaultSize="20rem"
        groupResizeBehavior="preserve-pixel-size"
        id="workspace-sidebar"
        maxSize="30rem"
        minSize="15rem"
      >
        <aside
          aria-label={t("source.labels.title")}
          className="relative flex h-full min-h-0 flex-col overflow-hidden"
        >
          <SourcePanel />
        </aside>
      </ResizablePanel>

      <ResizableHandle className="bg-transparent" style={{ width: 4 }} withHandle />

      <ResizablePanel className="overflow-hidden" id="workspace-content" minSize="44rem">
        <EditorStage key={activeItemId ?? sourceSelection?.sourcePath ?? "no-source"} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
