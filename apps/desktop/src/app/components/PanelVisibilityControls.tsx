import { PanelBottom, PanelBottomDashed, PanelLeft, PanelLeftDashed } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEditorViewState } from "@/app/hooks/useEditorViewState";

export function PanelVisibilityControls() {
  const { t } = useTranslation();
  const { showSourceDetails, setShowSourceDetails, showTimeline, setShowTimeline } =
    useEditorViewState();

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={t("app.panels.group")}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={
              showSourceDetails ? t("app.panels.hideLeftPane") : t("app.panels.showLeftPane")
            }
            aria-pressed={showSourceDetails}
            data-state={showSourceDetails ? "on" : "off"}
            className={showSourceDetails ? "text-primary" : undefined}
            onClick={() => setShowSourceDetails(!showSourceDetails)}
          >
            {showSourceDetails ? (
              <PanelLeft className="size-4" aria-hidden="true" />
            ) : (
              <PanelLeftDashed className="size-4" aria-hidden="true" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {showSourceDetails ? t("app.panels.hideLeftPane") : t("app.panels.showLeftPane")}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={
              showTimeline ? t("app.panels.hideBottomPane") : t("app.panels.showBottomPane")
            }
            aria-pressed={showTimeline}
            data-state={showTimeline ? "on" : "off"}
            className={showTimeline ? "text-primary" : undefined}
            onClick={() => setShowTimeline(!showTimeline)}
          >
            {showTimeline ? (
              <PanelBottom className="size-4" aria-hidden="true" />
            ) : (
              <PanelBottomDashed className="size-4" aria-hidden="true" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {showTimeline ? t("app.panels.hideBottomPane") : t("app.panels.showBottomPane")}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
