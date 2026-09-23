import { ChevronRight, Clock3, FolderOpen, Layers2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  SourceListTabs,
} from "@/features/source";
import { cn } from "@/lib/class-names.utils";

const groupByIcons = {
  none: Layers2,
  folder: FolderOpen,
  time: Clock3,
  imported: Upload,
};

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

      <ResizablePanelGroup id="editor-source" orientation="vertical" persisted>
        <ResizablePanel
          className="flex min-h-0 flex-col overflow-hidden! py-1"
          collapsedSize="36px"
          collapsible
          defaultSize="50"
          id="editor-source-imported-sources"
          minSize="300px"
        >
          <ResizablePanelControl panelId="editor-source-imported-sources">
            {({ isExpanded }) => (
              <div className="px-3">
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
          <div className="mt-2 flex min-h-0 flex-1 px-3">
            <SourceList>
              {({ tab }) => {
                const Icon = groupByIcons[tab];

                return (
                  <>
                    <div className="flex gap-2">
                      <SourceListSearch />

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="icon-sm" variant="outline">
                            <Icon />
                          </Button>
                        </PopoverTrigger>

                        <PopoverContent align="end" className="grid w-auto gap-1.5">
                          <Label>{t("source.labels.groupBy")}</Label>
                          <SourceListTabs />
                        </PopoverContent>
                      </Popover>

                      <SourceListCloseAll />
                    </div>

                    <ScrollArea
                      className={cn(
                        "-mx-2.5 min-h-0 flex-1 px-2.5",
                        tab !== "none" && "before:top-7",
                      )}
                    >
                      <SourceListContent />
                    </ScrollArea>
                  </>
                );
              }}
            </SourceList>
          </div>
        </ResizablePanel>

        <ResizableHandle className="bg-transparent px-3">
          <Separator />
        </ResizableHandle>

        <ResizablePanel
          className="flex min-h-0 flex-col overflow-hidden! py-1"
          collapsedSize="36px"
          collapsible
          defaultSize="50"
          id="editor-source-activity-feed"
          minSize="200px"
        >
          <ResizablePanelControl panelId="editor-source-activity-feed">
            {({ isExpanded }) => (
              <div className="px-3">
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

          <div className="mt-2 flex min-h-0 flex-1 flex-col px-3">
            <ScrollArea className="-mx-2.5 flex-1 px-2.5 before:top-2">
              <ActivityFeed />
            </ScrollArea>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </aside>
  );
}

export { AppLayoutSidebar };
