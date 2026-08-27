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

import { EditorPanelToggle } from "@/app/components/EditorPanel";
import { useEditorPanelControl } from "@/app/hooks/useEditorPanelControl";
import { useAppDispatch } from "@/app/store/hooks";
import {
  EDITOR_PANEL_IDS,
  editorPanelsResetToDefault,
  type EditorPanelId,
  type EditorPanelResetRequest,
} from "@/app/store/slices/editor-layout-slice";
import { ContextMenu, type ContextMenuOption } from "@/components/ui/context-menu";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const DEFAULT_EDITOR_PANEL_RESETS = [
  {
    panelId: EDITOR_PANEL_IDS.sourceDetails,
    resetCollapsed: true,
    resetSize: true,
    resetVisible: true,
  },
  {
    panelId: EDITOR_PANEL_IDS.timeline,
    resetCollapsed: true,
    resetSize: true,
    resetVisible: true,
  },
] as const satisfies readonly EditorPanelResetRequest[];

function usePanelVisibilityOption({
  icon,
  id,
  label,
  panelId,
}: {
  icon: ReactNode;
  id: string;
  label: string;
  panelId: EditorPanelId;
}): ContextMenuOption {
  const { t } = useTranslation();
  const switchInteractionRef = useRef(false);
  const { active, setActive, toggle } = useEditorPanelControl(panelId, "visibility");
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
    panelId: EDITOR_PANEL_IDS.sourceDetails,
  });
  const bottomPanelOption = usePanelVisibilityOption({
    id: "layout-toggle-bottom-panel",
    label: bottomPanelLabel,
    icon: <PanelBottom className="size-3" aria-hidden="true" />,
    panelId: EDITOR_PANEL_IDS.timeline,
  });

  const layoutOptions: ContextMenuOption[] = [
    leftPanelOption,
    bottomPanelOption,
    { id: "layout-divider", separator: true },
    {
      id: "layout-reset",
      children: t("app.panels.resetLayout"),
      icon: <RotateCcw className="size-3" aria-hidden="true" />,
      onSelect: () => dispatch(editorPanelsResetToDefault(DEFAULT_EDITOR_PANEL_RESETS)),
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

      <EditorPanelToggle
        panelId={EDITOR_PANEL_IDS.sourceDetails}
        mode="collapse"
        activeLabel={t("app.panels.hidePanel", { panel: leftPanelLabel })}
        inactiveLabel={t("app.panels.showPanel", { panel: leftPanelLabel })}
        activeIcon={<PanelLeft className="size-4" aria-hidden="true" />}
        inactiveIcon={<PanelLeftDashed className="size-4" aria-hidden="true" />}
      />

      <EditorPanelToggle
        panelId={EDITOR_PANEL_IDS.timeline}
        mode="collapse"
        activeLabel={t("app.panels.hidePanel", { panel: bottomPanelLabel })}
        inactiveLabel={t("app.panels.showPanel", { panel: bottomPanelLabel })}
        activeIcon={<PanelBottom className="size-4" aria-hidden="true" />}
        inactiveIcon={<PanelBottomDashed className="size-4" aria-hidden="true" />}
      />
    </div>
  );
}
