import { useTranslation } from "react-i18next";

import { Card } from "@/components/ui/card";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

import { ActivityFeed } from "@/features/activity";
import { SourcePanel } from "@/features/source";

import { EditorStage } from "./EditorStage";

export function EditorWorkspace() {
  const { t } = useTranslation();

  return (
    <ResizablePanelGroup className="px-1" id="workspace" persisted>
      <ResizablePanel
        className="overflow-hidden pb-1 pl-1"
        collapsedSize={0}
        collapsible
        defaultSize="20rem"
        groupResizeBehavior="preserve-pixel-size"
        id="workspace-sidebar"
        maxSize="30rem"
        minSize={290}
      >
        <aside
          aria-label={t("source.labels.title")}
          className="relative flex h-full min-h-0 flex-col overflow-hidden"
        >
          <SourcePanel />
        </aside>
      </ResizablePanel>

      <ResizableHandle
        className="self-start bg-transparent"
        style={{ height: "calc(100% - 4px)", width: 4 }}
        withHandle
      />

      <ResizablePanel className="overflow-hidden" id="workspace-content" minSize="44rem">
        <EditorStage />
      </ResizablePanel>

      <ResizableHandle
        className="self-start bg-transparent"
        style={{ height: "calc(100% - 4px)", width: 4 }}
        withHandle
      />

      <ResizablePanel
        className="overflow-hidden pr-1 pb-1"
        collapsedSize={0}
        collapsible
        defaultSize="20rem"
        groupResizeBehavior="preserve-pixel-size"
        id="workspace-activity"
        maxSize="30rem"
        minSize={200}
      >
        <Card className="relative size-full gap-2 pt-3 pb-0 ring-inset">
          <ActivityFeed />
        </Card>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
