import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react";

import { registerPanelSizeReset, resetPanelSizes } from "@/app/panel-layout-runtime";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  panelCollapsedChanged,
  selectPanel,
  selectPanelVisibility,
  type PanelId,
  type PanelState,
} from "@/app/store/slices/panel-layout-slice";
import { usePanelControl, type PanelToggleMode } from "@/components/layout/use-panel-control";
import { Button } from "@/components/ui/button";
import {
  PersistedResizablePanelGroup,
  ResizableHandle,
  ResizablePanel,
  usePanelRef,
} from "@/components/ui/resizable";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type PanelRef = ReturnType<typeof usePanelRef>;

interface PanelProps extends Omit<ComponentProps<typeof ResizablePanel>, "children" | "panelRef"> {
  children?: ReactNode | ((panel: PanelState) => ReactNode);
  panelId: PanelId;
  panelRef?: PanelRef;
  resetSize?: number | string;
}

function Panel({
  children,
  collapsible,
  onResize,
  panelId,
  panelRef: panelRefProp,
  resetSize,
  ...props
}: PanelProps) {
  const dispatch = useAppDispatch();
  const internalPanelRef = usePanelRef();
  const panelRef = panelRefProp ?? internalPanelRef;
  const panel = useAppSelector((state) => selectPanel(state, panelId));
  const sizeResetDepth = useRef(0);
  const resetToDefault = useCallback(() => {
    const imperativePanel = panelRef.current;
    if (resetSize === undefined || !imperativePanel) return;

    sizeResetDepth.current += 1;
    try {
      imperativePanel.resize(resetSize);
      if (panel.collapsed) imperativePanel.collapse();
    } finally {
      const finishReset = () => {
        sizeResetDepth.current = Math.max(0, sizeResetDepth.current - 1);
      };

      if (typeof requestAnimationFrame === "undefined") finishReset();
      else requestAnimationFrame(finishReset);
    }
  }, [panel.collapsed, panelRef, resetSize]);

  useEffect(() => {
    if (resetSize === undefined) return;
    return registerPanelSizeReset({ panelIds: [panelId], reset: resetToDefault });
  }, [panelId, resetSize, resetToDefault]);

  useEffect(() => {
    if (!collapsible || !panel.visible) return;

    const syncCollapsedState = () => {
      const imperativePanel = panelRef.current;
      if (!imperativePanel) return;

      if (panel.collapsed && !imperativePanel.isCollapsed()) imperativePanel.collapse();
      else if (!panel.collapsed && imperativePanel.isCollapsed()) imperativePanel.expand();
    };

    if (typeof requestAnimationFrame === "undefined") {
      syncCollapsedState();
      return;
    }

    const animationFrame = requestAnimationFrame(syncCollapsedState);
    return () => cancelAnimationFrame(animationFrame);
  }, [collapsible, panel.collapsed, panel.visible, panelRef]);

  if (!panel.visible) return null;

  return (
    <ResizablePanel
      {...props}
      collapsible={collapsible}
      panelRef={panelRef}
      onResize={(size, id, previousSize) => {
        onResize?.(size, id, previousSize);
        if (!collapsible || sizeResetDepth.current > 0) return;

        const collapsed = panelRef.current?.isCollapsed() ?? size.inPixels <= 0;
        if (collapsed !== panel.collapsed) {
          dispatch(panelCollapsedChanged({ panelId, collapsed }));
        }
      }}
    >
      {typeof children === "function" ? children(panel) : children}
    </ResizablePanel>
  );
}

interface PanelHandleProps extends ComponentProps<typeof ResizableHandle> {
  panelId: PanelId;
}

function PanelHandle({ onDoubleClick, panelId, withHandle, ...props }: PanelHandleProps) {
  const panel = useAppSelector((state) => selectPanel(state, panelId));

  if (!panel.visible) return null;

  return (
    <ResizableHandle
      {...props}
      withHandle={withHandle ?? !panel.collapsed}
      onDoubleClick={(event) => {
        onDoubleClick?.(event);
        if (!event.defaultPrevented) resetPanelSizes([panelId]);
      }}
    />
  );
}

interface PanelRegistration {
  id: string;
  panelId?: PanelId;
}

interface PersistedPanelGroupProps extends Omit<
  ComponentProps<typeof PersistedResizablePanelGroup>,
  "panelIds"
> {
  panels: readonly PanelRegistration[];
}

function PersistedPanelGroup({ id, panels, ...props }: PersistedPanelGroupProps) {
  const visibilityKey = useAppSelector((state) =>
    panels
      .map((panel) =>
        panel.panelId === undefined || selectPanelVisibility(state, panel.panelId) ? "1" : "0",
      )
      .join(""),
  );
  const panelIds = useMemo(
    () => panels.filter((_, index) => visibilityKey[index] === "1").map((panel) => panel.id),
    [panels, visibilityKey],
  );
  const registeredPanelIds = useMemo(
    () => panels.flatMap((panel) => (panel.panelId === undefined ? [] : [panel.panelId])),
    [panels],
  );

  useEffect(
    () => registerPanelSizeReset({ groupId: id, panelIds: registeredPanelIds }),
    [id, registeredPanelIds],
  );

  return <PersistedResizablePanelGroup {...props} id={id} panelIds={panelIds} />;
}

interface PanelToggleProps extends Omit<
  ComponentProps<typeof Button>,
  "aria-label" | "aria-pressed" | "children" | "onClick"
> {
  activeIcon: ReactNode;
  activeLabel: string;
  inactiveIcon: ReactNode;
  inactiveLabel: string;
  mode: PanelToggleMode;
  panelId: PanelId;
  tooltipSide?: ComponentProps<typeof TooltipContent>["side"];
}

function PanelToggle({
  activeIcon,
  activeLabel,
  className,
  inactiveIcon,
  inactiveLabel,
  mode,
  panelId,
  size = "icon-sm",
  tooltipSide,
  variant = "ghost",
  ...props
}: PanelToggleProps) {
  const { active, toggle } = usePanelControl(panelId, mode);
  const label = active ? activeLabel : inactiveLabel;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          {...props}
          type="button"
          variant={variant}
          size={size}
          aria-label={label}
          aria-pressed={active}
          data-state={active ? "on" : "off"}
          className={cn(active && "text-primary", className)}
          onClick={toggle}
        >
          {active ? activeIcon : inactiveIcon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  );
}

export { Panel, PanelHandle, PanelToggle, PersistedPanelGroup };
export type { PanelRegistration, PanelToggleMode };
