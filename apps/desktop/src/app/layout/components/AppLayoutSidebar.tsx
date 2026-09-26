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
import { Separator } from "@/components/ui/separator";

import { ActivityFeed } from "@/features/activity";
import {
  SourceList,
  SourceListCloseAll,
  SourceListContent,
  SourceListSearch,
} from "@/features/source";
import { cn } from "@/lib/class-names.utils";

function AppLayoutSidebar() {
  const { t } = useTranslation();

  return (
    <aside
      aria-label={t("app.labels.explorer")}
      className="@container relative flex size-full flex-col pt-3"
    >
      <h3
        className="mx-3 mb-1 font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
        id="source-panel-title"
      >
        {t("app.labels.explorer")}
      </h3>

      <ResizablePanelGroup
        className="*:data-panel:transition-[flex-grow,flex-basis] *:data-panel:duration-200 *:data-panel:ease-out has-data-[separator=active]:*:data-panel:transition-none motion-reduce:*:data-panel:transition-none"
        id="editor-source"
        orientation="vertical"
        persisted
      >
        <ResizablePanel
          className="flex min-h-0 flex-col overflow-hidden!"
          collapsedSize="36px"
          collapsible
          defaultSize="45"
          id="editor-source-imported-sources"
          minSize="300px"
        >
          <ResizablePanelControl panelId="editor-source-imported-sources">
            {({ isExpanded }) => (
              <div className="px-3 py-1">
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
              </div>
            )}
          </ResizablePanelControl>

          <SourceList>
            <div className="mt-1 grid min-h-0 px-3">
              <div className="flex gap-2">
                <SourceListSearch />
                <SourceListCloseAll />
              </div>

              <ScrollArea className="-mx-2.5 min-h-0 flex-1 px-2.5">
                <SourceListContent className="py-2" />
              </ScrollArea>
            </div>
          </SourceList>
        </ResizablePanel>

        <ResizableHandle className="bg-transparent px-3">
          <Separator />
        </ResizableHandle>

        <ResizablePanel
          className="flex min-h-0 flex-col overflow-hidden!"
          collapsedSize="36px"
          collapsible
          defaultSize="30"
          id="editor-source-activity-feed"
          minSize="200px"
        >
          <ResizablePanelControl panelId="editor-source-activity-feed">
            {({ isExpanded }) => (
              <div className="px-3 py-1">
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
              </div>
            )}
          </ResizablePanelControl>

          <div className="mt-1 grid min-h-0 px-3">
            <ScrollArea className="-mx-2.5 flex-1 px-2.5 before:top-2">
              <ActivityFeed className="pb-2" />
            </ScrollArea>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </aside>
  );
}

export { AppLayoutSidebar };
