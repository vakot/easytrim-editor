import { Slot } from "radix-ui";
import {
  createContext,
  useCallback,
  useContext,
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
import { usePanelControl, type PanelControlMode } from "@/components/layout/use-panel-control";
import {
  PersistedResizablePanelGroup,
  ResizableHandle,
  ResizablePanel,
  usePanelRef,
} from "@/components/ui/resizable";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type PanelRef = ReturnType<typeof usePanelRef>;

interface PanelProps extends Omit<
  ComponentProps<typeof ResizablePanel>,
  "children" | "id" | "panelRef"
> {
  children?: ReactNode | ((panel: PanelState) => ReactNode);
  id: PanelId;
  panelRef?: PanelRef;
  resetSize?: number | string;
}

function Panel({
  children,
  collapsible,
  id,
  onResize,
  panelRef: panelRefProp,
  resetSize,
  ...props
}: PanelProps) {
  const dispatch = useAppDispatch();
  const internalPanelRef = usePanelRef();
  const panelRef = panelRefProp ?? internalPanelRef;
  const panel = useAppSelector((state) => selectPanel(state, id));
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
    return registerPanelSizeReset({ panelIds: [id], reset: resetToDefault });
  }, [id, resetSize, resetToDefault]);

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
      id={id}
      panelRef={panelRef}
      onResize={(size, resizablePanelId, previousSize) => {
        onResize?.(size, resizablePanelId, previousSize);
        if (!collapsible || sizeResetDepth.current > 0) return;

        const collapsed = panelRef.current?.isCollapsed() ?? size.inPixels <= 0;
        if (collapsed !== panel.collapsed) {
          dispatch(panelCollapsedChanged({ panelId: id, collapsed }));
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

interface PanelControlContextValue {
  hasTooltip: boolean;
  mode?: PanelControlMode;
  panelId?: PanelId;
}

const PanelControlContext = createContext<PanelControlContextValue | null>(null);

interface PanelControlProps {
  children: ReactNode;
  mode?: PanelControlMode;
  panelId?: PanelId;
  tooltip?: ReactNode;
  tooltipProps?: ComponentProps<typeof TooltipContent>;
}

function PanelControl({
  children,
  mode = "visibility",
  panelId,
  tooltip,
  tooltipProps,
}: PanelControlProps) {
  const hasTooltip = tooltip !== undefined;
  const context = useMemo<PanelControlContextValue>(
    () => ({ hasTooltip, mode, panelId }),
    [hasTooltip, mode, panelId],
  );
  const content = hasTooltip ? (
    <Tooltip>
      {children}
      <TooltipContent {...tooltipProps}>{tooltip}</TooltipContent>
    </Tooltip>
  ) : (
    children
  );

  return <PanelControlContext.Provider value={context}>{content}</PanelControlContext.Provider>;
}

interface PanelControlToggleProps extends ComponentProps<typeof Slot.Root> {
  mode?: PanelControlMode;
  panelId?: PanelId;
}

function PanelControlToggle({
  "aria-pressed": ariaPressed,
  className,
  mode: modeProp,
  onClick,
  panelId: panelIdProp,
  ...props
}: PanelControlToggleProps) {
  const control = usePanelControlContext();
  const panelId = panelIdProp ?? control.panelId;
  const mode = modeProp ?? control.mode ?? "visibility";
  assertPanelId(panelId);
  const { active, toggle } = usePanelControl(panelId, mode);
  const trigger = (
    <Slot.Root
      {...props}
      aria-pressed={ariaPressed ?? active}
      data-panel-state={active ? "on" : "off"}
      data-panel-control-toggle=""
      className={cn("group/panel-control-toggle", className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) toggle();
      }}
    />
  );

  return control.hasTooltip ? <TooltipTrigger asChild>{trigger}</TooltipTrigger> : trigger;
}

function usePanelControlContext() {
  const context = useContext(PanelControlContext);
  if (!context) {
    throw new Error("PanelControlToggle must be used within PanelControl");
  }
  return context;
}

function assertPanelId(panelId: PanelId | undefined): asserts panelId is PanelId {
  if (panelId === undefined) {
    throw new Error("PanelControl or PanelControlToggle must provide a panelId");
  }
}

export { Panel, PanelControl, PanelControlToggle, PanelHandle, PersistedPanelGroup };
export type { PanelControlMode, PanelRegistration };
