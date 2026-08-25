import {
  LayoutPanelLeft,
  PanelBottom,
  PanelBottomDashed,
  PanelLeft,
  PanelLeftDashed,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { ContextMenu, type ContextMenuOption } from "@/components/ui/context-menu";
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
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const dispatch = useAppDispatch();
  const showSourceDetails = useAppSelector(selectShowSourceDetails);
  const showTimeline = useAppSelector(selectShowTimeline);
  const layoutOptions: ContextMenuOption[] = [
    {
      id: "layout-toggle-left-panel",
      children: showSourceDetails ? t("app.panels.hideLeftPane") : t("app.panels.showLeftPane"),
      icon: showSourceDetails ? (
        <PanelLeft className="size-3" aria-hidden="true" />
      ) : (
        <PanelLeftDashed className="size-3" aria-hidden="true" />
      ),
      selected: showSourceDetails,
      shouldCloseOnClick: false,
      onSelect: () => dispatch(sourceDetailsVisibilityChanged(!showSourceDetails)),
    },
    {
      id: "layout-toggle-bottom-panel",
      children: showTimeline ? t("app.panels.hideBottomPane") : t("app.panels.showBottomPane"),
      icon: showTimeline ? (
        <PanelBottom className="size-3" aria-hidden="true" />
      ) : (
        <PanelBottomDashed className="size-3" aria-hidden="true" />
      ),
      selected: showTimeline,
      shouldCloseOnClick: false,
      onSelect: () => dispatch(timelineVisibilityChanged(!showTimeline)),
    },
    { id: "layout-divider", separator: true },
    {
      id: "layout-reset",
      children: t("app.panels.resetLayout"),
      icon: <RotateCcw className="size-3" aria-hidden="true" />,
      onSelect: () => dispatch(editorLayoutReset()),
    },
  ];

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={t("app.panels.group")}>
      <ContextMenu
        options={layoutOptions}
        className="size-7 p-0"
        open={layoutMenuOpen}
        onOpenChange={setLayoutMenuOpen}
        onTriggerClick={() => setLayoutMenuOpen((open) => !open)}
      >
        <>
          <LayoutPanelLeft className="size-4" aria-hidden="true" />
          <span className="sr-only">{t("app.panels.layoutMenu")}</span>
        </>
      </ContextMenu>

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
    </div>
  );
}
