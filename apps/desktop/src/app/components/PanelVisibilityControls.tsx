import {
  LayoutPanelLeft,
  PanelBottom,
  PanelBottomDashed,
  PanelLeft,
  PanelLeftDashed,
  RotateCcw,
} from "lucide-react";
import { useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { ContextMenu, type ContextMenuOption } from "@/components/ui/context-menu";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  editorLayoutReset,
  selectPanelVisibility,
  panelVisibilityChanged,
} from "@/app/store/slices/editor-layout-slice";

export function PanelVisibilityControls() {
  const { t } = useTranslation();
  const switchInteractionRef = useRef(false);
  const dispatch = useAppDispatch();
  const isLeftPanelVisible = useAppSelector((state) => selectPanelVisibility(state, "left"));
  const isBottomPanelVisible = useAppSelector((state) => selectPanelVisibility(state, "bottom"));

  const layoutPanelOption = (
    id: string,
    label: string,
    icon: ReactNode,
    checked: boolean,
    onCheckedChange: (checked: boolean) => void,
    tooltip: string,
  ): ContextMenuOption => ({
    id,
    children: label,
    icon,
    suffix: (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Switch
              size="sm"
              checked={checked}
              onCheckedChange={onCheckedChange}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={() => {
                switchInteractionRef.current = true;
              }}
              onPointerDown={(event) => {
                switchInteractionRef.current = true;
                event.stopPropagation();
              }}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">{tooltip}</TooltipContent>
      </Tooltip>
    ),
    shouldCloseOnClick: false,
    onSelect: () => {
      if (switchInteractionRef.current) {
        switchInteractionRef.current = false;
        return;
      }
      onCheckedChange(!checked);
    },
  });

  const layoutOptions: ContextMenuOption[] = [
    layoutPanelOption(
      "layout-toggle-left-panel",
      t("app.panels.leftPanel"),
      <PanelLeft className="size-3" aria-hidden="true" />,
      isLeftPanelVisible,
      (checked) => dispatch(panelVisibilityChanged({ panelId: "left", visible: checked })),
      isLeftPanelVisible
        ? t("app.panels.hidePanel", { panel: t("app.panels.leftPanel") })
        : t("app.panels.showPanel", { panel: t("app.panels.leftPanel") }),
    ),
    layoutPanelOption(
      "layout-toggle-bottom-panel",
      t("app.panels.bottomPanel"),
      <PanelBottom className="size-3" aria-hidden="true" />,
      isBottomPanelVisible,
      (checked) => dispatch(panelVisibilityChanged({ panelId: "bottom", visible: checked })),
      isBottomPanelVisible
        ? t("app.panels.hidePanel", { panel: t("app.panels.bottomPanel") })
        : t("app.panels.showPanel", { panel: t("app.panels.bottomPanel") }),
    ),
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
      <ContextMenu options={layoutOptions} className="size-7 p-0">
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
              isLeftPanelVisible
                ? t("app.panels.hidePanel", { panel: t("app.panels.leftPanel") })
                : t("app.panels.showPanel", { panel: t("app.panels.leftPanel") })
            }
            aria-pressed={isLeftPanelVisible}
            data-state={isLeftPanelVisible ? "on" : "off"}
            className={isLeftPanelVisible ? "text-primary" : undefined}
            onClick={() =>
              dispatch(panelVisibilityChanged({ panelId: "left", visible: !isLeftPanelVisible }))
            }
          >
            {isLeftPanelVisible ? (
              <PanelLeft className="size-4" aria-hidden="true" />
            ) : (
              <PanelLeftDashed className="size-4" aria-hidden="true" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isLeftPanelVisible
            ? t("app.panels.hidePanel", { panel: t("app.panels.leftPanel") })
            : t("app.panels.showPanel", { panel: t("app.panels.leftPanel") })}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={
              isBottomPanelVisible
                ? t("app.panels.hidePanel", { panel: t("app.panels.bottomPanel") })
                : t("app.panels.showPanel", { panel: t("app.panels.bottomPanel") })
            }
            aria-pressed={isBottomPanelVisible}
            data-state={isBottomPanelVisible ? "on" : "off"}
            className={isBottomPanelVisible ? "text-primary" : undefined}
            onClick={() =>
              dispatch(
                panelVisibilityChanged({ panelId: "bottom", visible: !isBottomPanelVisible }),
              )
            }
          >
            {isBottomPanelVisible ? (
              <PanelBottom className="size-4" aria-hidden="true" />
            ) : (
              <PanelBottomDashed className="size-4" aria-hidden="true" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isBottomPanelVisible
            ? t("app.panels.hidePanel", { panel: t("app.panels.bottomPanel") })
            : t("app.panels.showPanel", { panel: t("app.panels.bottomPanel") })}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
