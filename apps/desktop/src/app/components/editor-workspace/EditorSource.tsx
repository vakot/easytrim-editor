import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelControl,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";

import { ActivityFeed } from "@/features/activity";
import { SourceList } from "@/features/source";
import { cn } from "@/lib/class-names.utils";

export function EditorSource() {
  const { t } = useTranslation();

  return (
    <aside
      aria-label={t("app.labels.explorer")}
      className="@container relative flex size-full flex-col pt-3"
    >
      <h3
        className="mx-3 mb-3 font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
        id="source-panel-title"
      >
        {t("app.labels.explorer")}
      </h3>

      <ResizablePanelGroup id="editor-source" orientation="vertical" persisted>
        <ResizablePanel
          className="flex min-h-0 flex-col overflow-hidden! p-1"
          collapsedSize="36px"
          collapsible
          defaultSize="50"
          id="editor-source-imported-sources"
          minSize="150px"
        >
          <ResizablePanelControl panelId="editor-source-imported-sources">
            {({ isExpanded }) => (
              <Button
                className="w-full justify-baseline px-2 text-secondary-foreground"
                size="sm"
                variant="ghost"
              >
                <ChevronRight
                  className={cn("shrink-0 transition-transform", isExpanded && "rotate-90")}
                />
                {t("source.labels.importedSources")}
              </Button>
            )}
          </ResizablePanelControl>

          <div className="mt-2 min-h-0 flex-1">
            <ScrollArea className="size-full">
              <div className="px-2 pt-0.5">
                <SourceList />
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel
          className="flex min-h-0 flex-col overflow-hidden! p-1"
          collapsedSize="36px"
          collapsible
          defaultSize="50"
          id="editor-source-activity-feed"
          minSize="150px"
        >
          <ResizablePanelControl panelId="editor-source-activity-feed">
            {({ isExpanded }) => (
              <Button
                className="w-full justify-baseline px-2 text-secondary-foreground"
                size="sm"
                variant="ghost"
              >
                <ChevronRight
                  className={cn("shrink-0 transition-transform", isExpanded && "rotate-90")}
                />
                {t("app.labels.activityFeed")}
              </Button>
            )}
          </ResizablePanelControl>

          <div className="mt-2 min-h-0 flex-1">
            <ScrollArea className="size-full px-2 before:top-2">
              <ActivityFeed />
            </ScrollArea>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </aside>
  );
}
