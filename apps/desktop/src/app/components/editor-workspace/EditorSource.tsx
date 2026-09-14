import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";

import { ActivityFeed } from "@/features/activity";
import { ImportedSources } from "@/features/source";

export function EditorSource() {
  const { t } = useTranslation();

  return (
    <aside
      aria-label={t("source.labels.importedSources")}
      className="@container relative flex size-full min-h-0 flex-col pt-3"
    >
      <h3
        className="mx-3 mb-3 font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
        id="source-panel-title"
      >
        {t("source.labels.importedSources")}
      </h3>

      <ImportedSources />

      <Collapsible className="shrink-0 border-t border-foreground/10 p-1" defaultOpen={false}>
        <CollapsibleTrigger asChild>
          <Button
            className="group w-full justify-baseline px-2 text-secondary-foreground"
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
