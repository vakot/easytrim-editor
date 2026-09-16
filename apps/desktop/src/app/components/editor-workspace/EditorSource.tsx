import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";

import { ActivityFeed } from "@/features/activity";
import {
  ExportQueueWidget,
  ExportQueueWidgetActive,
  ExportQueueWidgetActiveDetails,
  ExportQueueWidgetPendingList,
} from "@/features/export";
import { SourceGrid } from "@/features/source";

export function EditorSource() {
  const { t } = useTranslation();

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

      <Collapsible className="flex flex-1 flex-col p-1 data-[state=closed]:flex-none" defaultOpen>
        <CollapsibleTrigger asChild>
          <Button
            className="group w-full justify-baseline px-2 text-secondary-foreground data-open:bg-transparent data-open:text-secondary-foreground!"
            size="sm"
            variant="ghost"
          >
            <ChevronRight className="shrink-0 transition-transform group-data-[state=open]:rotate-90" />
            {t("source.labels.explorer")}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <SourceGrid />
        </CollapsibleContent>
      </Collapsible>

      <Collapsible className="shrink-0 border-t border-foreground/10 p-1" defaultOpen={false}>
        <CollapsibleTrigger asChild>
          <Button
            className="group w-full justify-baseline px-2 text-secondary-foreground data-open:bg-transparent data-open:text-secondary-foreground!"
            size="sm"
            variant="ghost"
          >
            <ChevronRight className="shrink-0 transition-transform group-data-[state=open]:rotate-90" />
            {t("app.labels.exportQueue")}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="min-h-0 p-2 pt-1">
          <Card className="max-h-96 min-h-0 rounded-lg p-0">
            <ExportQueueWidget className="flex h-full min-h-0 flex-col">
              <ExportQueueWidgetActive className="aspect-video max-h-48 shrink-0">
                <ExportQueueWidgetActiveDetails className="pr-2.5" />
              </ExportQueueWidgetActive>
              <ScrollArea className="h-48 pr-0.5" type="always">
                <ExportQueueWidgetPendingList className="py-1" />
              </ScrollArea>
            </ExportQueueWidget>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible className="shrink-0 border-t border-foreground/10 p-1" defaultOpen={false}>
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

        <CollapsibleContent className="max-h-64 min-h-0">
          <ScrollArea className="h-64 px-2 before:top-2">
            <ActivityFeed />
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>
    </aside>
  );
}
