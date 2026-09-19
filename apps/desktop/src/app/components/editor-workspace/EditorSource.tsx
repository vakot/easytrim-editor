import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectExportQueue } from "@/app/store/slices/editing-instances-slice";
import {
  editorSourceCollapsibleStateChanged,
  selectEditorSourceCollapsibleState,
} from "@/app/store/slices/preferences-slice";
import { ActivityFeed } from "@/features/activity";
import {
  ExportQueueWidget,
  ExportQueueWidgetActive,
  ExportQueueWidgetActiveDetails,
  ExportQueueWidgetPendingItem,
  ExportQueueWidgetPendingList,
  ExportQueueWidgetPendingListEmpty,
} from "@/features/export";
import { SourceList } from "@/features/source";

export function EditorSource() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { active, pending } = useAppSelector(selectExportQueue);
  const collapsibleState = useAppSelector(selectEditorSourceCollapsibleState);
  const hasExportQueueItems = active !== undefined || pending.length > 0;

  const onCollapsibleStateChange = (section: keyof typeof collapsibleState, open: boolean) => {
    dispatch(editorSourceCollapsibleStateChanged({ open, section }));
  };

  const exportQueueTrigger = (
    <CollapsibleTrigger asChild disabled={!hasExportQueueItems}>
      <Button
        className="group w-full justify-baseline px-2 text-secondary-foreground data-open:bg-transparent data-open:text-secondary-foreground!"
        disabled={!hasExportQueueItems}
        size="sm"
        variant="ghost"
      >
        <ChevronRight className="shrink-0 transition-transform group-data-[state=open]:rotate-90" />
        {t("app.labels.exportQueue")}
      </Button>
    </CollapsibleTrigger>
  );

  return (
    <aside
      aria-label={t("app.labels.explorer")}
      className="@container relative flex size-full min-h-0 flex-col pt-3"
    >
      <h3
        className="mx-3 mb-3 font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
        id="source-panel-title"
      >
        {t("app.labels.explorer")}
      </h3>

      <Collapsible
        className="flex min-h-0 flex-1 flex-col p-1 data-[state=closed]:flex-none"
        onOpenChange={(open) => onCollapsibleStateChange("sourceExplorer", open)}
        open={collapsibleState.sourceExplorer}
      >
        <CollapsibleTrigger asChild>
          <Button
            className="group w-full justify-baseline px-2 text-secondary-foreground data-open:bg-transparent data-open:text-secondary-foreground!"
            size="sm"
            variant="ghost"
          >
            <ChevronRight className="shrink-0 transition-transform group-data-[state=open]:rotate-90" />
            {t("source.labels.importedSources")}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-2 flex min-h-0 flex-1 flex-col">
          <SourceList />
        </CollapsibleContent>
      </Collapsible>

      <Collapsible
        className="shrink-0 border-t border-foreground/10 p-1"
        onOpenChange={(open) => onCollapsibleStateChange("exportQueue", open)}
        open={hasExportQueueItems && collapsibleState.exportQueue}
      >
        {hasExportQueueItems ? (
          exportQueueTrigger
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block" tabIndex={0}>
                {exportQueueTrigger}
              </span>
            </TooltipTrigger>
            <TooltipContent>{t("app.tooltips.exportQueueEmpty")}</TooltipContent>
          </Tooltip>
        )}

        <CollapsibleContent className="flex min-h-0 flex-1 flex-col p-2">
          <Card className="size-full min-h-0 rounded-lg p-0">
            <ExportQueueWidget className="flex h-full min-h-0 flex-col">
              <ExportQueueWidgetActive className="aspect-video max-h-48 shrink-0">
                <ExportQueueWidgetActiveDetails className="pr-2.5" />
              </ExportQueueWidgetActive>

              <div className="h-48 py-1">
                <ExportQueueWidgetPendingListEmpty className="size-full" />
                <ExportQueueWidgetPendingList className="h-48 py-1">
                  {({ items }) => (
                    <ScrollArea className="pr-0.5">
                      {items.map((item) => (
                        <ExportQueueWidgetPendingItem item={item} key={item.attempt.id} />
                      ))}
                    </ScrollArea>
                  )}
                </ExportQueueWidgetPendingList>
              </div>
            </ExportQueueWidget>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible
        className="shrink-0 border-t border-foreground/10 p-1"
        onOpenChange={(open) => onCollapsibleStateChange("activityFeed", open)}
        open={collapsibleState.activityFeed}
      >
        <CollapsibleTrigger asChild>
          <Button
            className="group w-full justify-baseline px-2 text-secondary-foreground data-open:bg-transparent data-open:text-secondary-foreground!"
            size="sm"
            variant="ghost"
          >
            <ChevronRight className="shrink-0 transition-transform group-data-[state=open]:rotate-90" />
            {t("app.labels.activityFeed")}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-2 min-h-0 flex-1">
          <ScrollArea className="h-72 px-2 before:top-2">
            <ActivityFeed />
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>
    </aside>
  );
}
