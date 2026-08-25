import {
  PanelBottom,
  PanelBottomDashed,
  PanelLeft,
  PanelLeftDashed,
  RotateCcw,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  selectShowSourceDetails,
  selectShowTimeline,
  editorLayoutReset,
  sourceDetailsVisibilityChanged,
  timelineVisibilityChanged,
} from "@/app/store/slices/editor-layout-slice";

export function PanelVisibilityControls() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const showSourceDetails = useAppSelector(selectShowSourceDetails);
  const showTimeline = useAppSelector(selectShowTimeline);

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
            onClick={() => dispatch(sourceDetailsVisibilityChanged(!showSourceDetails))}
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
            onClick={() => dispatch(timelineVisibilityChanged(!showTimeline))}
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

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("app.panels.resetLayout")}
            onClick={() => dispatch(editorLayoutReset())}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("app.panels.resetLayout")}</TooltipContent>
      </Tooltip>
    </div>
  );
}
