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
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Switch } from "@/components/ui/switch";

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

function PanelVisibilityMenuItem({
  icon,
  label,
  panelId,
}: {
  icon: ReactNode;
  label: string;
  panelId: PanelId;
}) {
  const { t } = useTranslation();
  const switchInteractionRef = useRef(false);
  const { active, setActive, toggle } = usePanelControl(panelId, "visibility");
  const tooltip = active
    ? t("app.panels.hidePanel", { panel: label })
    : t("app.panels.showPanel", { panel: label });

  return (
    <MenuItem
      icon={icon}
      tooltip={tooltip}
      tooltipProps={{ side: "right" }}
      suffix={
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
      }
      onSelect={(event) => {
        event.preventDefault();
        if (switchInteractionRef.current) {
          switchInteractionRef.current = false;
          return;
        }
        toggle();
      }}
    >
      {label}
    </MenuItem>
  );
}

export function PanelVisibilityControls() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const leftPanelLabel = t("app.panels.leftPanel");
  const bottomPanelLabel = t("app.panels.bottomPanel");

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={t("app.panels.group")}>
      <Menu modal={false}>
        <MenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("app.panels.layoutMenu")}
          >
            <LayoutPanelLeft className="size-4" aria-hidden="true" />
          </Button>
        </MenuTrigger>
        <MenuContent>
          <PanelVisibilityMenuItem
            label={leftPanelLabel}
            icon={<PanelLeft className="size-3" aria-hidden="true" />}
            panelId={PANEL_IDS.sourceDetails}
          />
          <PanelVisibilityMenuItem
            label={bottomPanelLabel}
            icon={<PanelBottom className="size-3" aria-hidden="true" />}
            panelId={PANEL_IDS.timeline}
          />
          <MenuSeparator />
          <MenuItem
            icon={<RotateCcw className="size-3" aria-hidden="true" />}
            onSelect={() => dispatch(panelsResetToDefault(DEFAULT_PANEL_RESETS))}
          >
            {t("app.panels.resetLayout")}
          </MenuItem>
        </MenuContent>
      </Menu>

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
