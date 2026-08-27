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

import { useAppDispatch } from "@/app/store/hooks";
import {
  PANEL_IDS,
  panelsResetToDefault,
  type PanelId,
  type PanelResetRequest,
} from "@/app/store/slices/panel-layout-slice";
import { PanelControl, PanelControlToggle } from "@/components/layout/panel";
import { usePanelControl } from "@/components/layout/use-panel-control";
import { Button } from "@/components/ui/button";
import { ContextMenu, type ContextMenuOption } from "@/components/ui/context-menu";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const DEFAULT_PANEL_RESETS = [
  {
    panelId: PANEL_IDS.sourceDetails,
    resetCollapsed: true,
    resetSize: true,
    resetVisible: true,
  },
  {
    panelId: PANEL_IDS.timeline,
    resetCollapsed: true,
    resetSize: true,
    resetVisible: true,
  },
] as const satisfies readonly PanelResetRequest[];

function usePanelVisibilityOption({
  icon,
  id,
  label,
  panelId,
}: {
  icon: ReactNode;
  id: string;
  label: string;
  panelId: PanelId;
}): ContextMenuOption {
  const { t } = useTranslation();
  const switchInteractionRef = useRef(false);
  const { active, setActive, toggle } = usePanelControl(panelId, "visibility");
  const tooltip = active
    ? t("app.panels.hidePanel", { panel: label })
    : t("app.panels.showPanel", { panel: label });

  return {
    id,
    children: label,
    icon,
    suffix: (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Switch
              size="sm"
              checked={active}
              onCheckedChange={setActive}
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
      toggle();
    },
  };
}

export function PanelVisibilityControls() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const leftPanelLabel = t("app.panels.leftPanel");
  const bottomPanelLabel = t("app.panels.bottomPanel");
  const leftPanelOption = usePanelVisibilityOption({
    id: "layout-toggle-left-panel",
    label: leftPanelLabel,
    icon: <PanelLeft className="size-3" aria-hidden="true" />,
    panelId: PANEL_IDS.sourceDetails,
  });
  const bottomPanelOption = usePanelVisibilityOption({
    id: "layout-toggle-bottom-panel",
    label: bottomPanelLabel,
    icon: <PanelBottom className="size-3" aria-hidden="true" />,
    panelId: PANEL_IDS.timeline,
  });

  const layoutOptions: ContextMenuOption[] = [
    leftPanelOption,
    bottomPanelOption,
    { id: "layout-divider", separator: true },
    {
      id: "layout-reset",
      children: t("app.panels.resetLayout"),
      icon: <RotateCcw className="size-3" aria-hidden="true" />,
      onSelect: () => dispatch(panelsResetToDefault(DEFAULT_PANEL_RESETS)),
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

      <PanelControl
        panelId={PANEL_IDS.sourceDetails}
        mode="collapse"
        tooltip={t("app.panels.togglePanel", { panel: leftPanelLabel })}
      >
        <PanelControlToggle>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("app.panels.togglePanel", { panel: leftPanelLabel })}
          >
            <PanelLeft
              className="size-4 group-data-[panel-state=off]/panel-control-toggle:hidden"
              aria-hidden="true"
            />
            <PanelLeftDashed
              className="hidden size-4 group-data-[panel-state=off]/panel-control-toggle:block"
              aria-hidden="true"
            />
          </Button>
        </PanelControlToggle>
      </PanelControl>

      <PanelControl
        panelId={PANEL_IDS.timeline}
        mode="collapse"
        tooltip={t("app.panels.togglePanel", { panel: bottomPanelLabel })}
      >
        <PanelControlToggle>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("app.panels.togglePanel", { panel: bottomPanelLabel })}
          >
            <PanelBottom
              className="size-4 group-data-[panel-state=off]/panel-control-toggle:hidden"
              aria-hidden="true"
            />
            <PanelBottomDashed
              className="hidden size-4 group-data-[panel-state=off]/panel-control-toggle:block"
              aria-hidden="true"
            />
          </Button>
        </PanelControlToggle>
      </PanelControl>
    </div>
  );
}
