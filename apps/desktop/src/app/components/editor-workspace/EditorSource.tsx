import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  editorSourceCollapsibleStateChanged,
  selectEditorSourceCollapsibleState,
} from "@/app/store/slices/preferences-slice";
import { ActivityFeed } from "@/features/activity";
import { SourceList } from "@/features/source";

export function EditorSource() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const collapsibleState = useAppSelector(selectEditorSourceCollapsibleState);

  const onCollapsibleStateChange = (section: keyof typeof collapsibleState, open: boolean) => {
    dispatch(editorSourceCollapsibleStateChanged({ open, section }));
  };

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
