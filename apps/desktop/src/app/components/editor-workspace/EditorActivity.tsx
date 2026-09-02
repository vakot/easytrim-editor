import { t } from "i18next";
import { Info, X } from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { ResizablePanelControl } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { ActivityFeed } from "@/features/activity";

export function EditorActivity() {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="relative flex h-full min-h-0 flex-col gap-2 pt-3">
      <div className="mx-3 flex items-center gap-1.5">
        <h3
          className="font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
          id={titleId}
        >
          {t("app.labels.activityFeed")}
        </h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label={t("app.accessibility.activityFeedPrivacy")}
              className="inline-flex size-4 items-center justify-center text-primary"
              type="button"
            >
              <Info aria-hidden="true" className="size-3.5 text-primary" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t("app.tooltips.activityFeedPrivacy")}</TooltipContent>
        </Tooltip>
      </div>

      <ResizablePanelControl panelId="workspace-activity">
        <Button
          className="absolute top-1 right-3 text-secondary-foreground"
          size="icon-xs"
          variant="ghost"
        >
          <X aria-hidden="true" />
        </Button>
      </ResizablePanelControl>

      <ScrollArea className="px-3">
        <ActivityFeed />
      </ScrollArea>
    </section>
  );
}
