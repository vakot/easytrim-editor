import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ComponentProps,
  type ReactNode,
} from "react";

import { registerEditorLayoutReset } from "@/app/editor-layout-runtime";
import {
  useEditorPanelControl,
  type EditorPanelToggleMode,
} from "@/app/hooks/useEditorPanelControl";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  panelCollapsedChanged,
  selectEditorPanel,
  selectPanelVisibility,
  type EditorPanelId,
  type EditorPanelState,
} from "@/app/store/slices/editor-layout-slice";
import { Button } from "@/components/ui/button";
import {
  PersistedResizablePanelGroup,
  ResizableHandle,
  ResizablePanel,
  usePanelRef,
} from "@/components/ui/resizable";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type EditorPanelRef = ReturnType<typeof usePanelRef>;

interface EditorPanelContextValue {
  panel: EditorPanelState;
  panelId: EditorPanelId;
  panelRef: EditorPanelRef;
  resetToDefault: () => void;
}

const EditorPanelContext = createContext<EditorPanelContextValue | null>(null);

interface EditorPanelProps {
  children: ReactNode;
  panelId: EditorPanelId;
  panelRef?: EditorPanelRef;
  resetSize?: number | string;
}

function EditorPanel({ children, panelId, panelRef: panelRefProp, resetSize }: EditorPanelProps) {
  const internalPanelRef = usePanelRef();
  const panelRef = panelRefProp ?? internalPanelRef;
  const panel = useAppSelector((state) => selectEditorPanel(state, panelId));
  const resetToDefault = useCallback(() => {
    if (resetSize !== undefined) panelRef.current?.resize(resetSize);
  }, [panelRef, resetSize]);

  useEffect(() => {
    if (resetSize === undefined) return;
    return registerEditorLayoutReset(resetToDefault);
  }, [resetSize, resetToDefault]);

  const context = useMemo<EditorPanelContextValue>(
    () => ({ panel, panelId, panelRef, resetToDefault }),
    [panel, panelId, panelRef, resetToDefault],
  );

  if (!panel.visible) return null;

  return <EditorPanelContext.Provider value={context}>{children}</EditorPanelContext.Provider>;
}

interface EditorPanelContentProps extends Omit<
  ComponentProps<typeof ResizablePanel>,
  "children" | "panelRef"
> {
  children?: ReactNode | ((panel: EditorPanelState) => ReactNode);
}

function EditorPanelContent({
  children,
  collapsible,
  onResize,
  ...props
}: EditorPanelContentProps) {
  const { panel, panelId, panelRef } = useEditorPanelContext();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!collapsible) return;

    const animationFrame = requestAnimationFrame(() => {
      const imperativePanel = panelRef.current;
      if (!imperativePanel) return;

      if (panel.collapsed && !imperativePanel.isCollapsed()) {
        imperativePanel.collapse();
      } else if (!panel.collapsed && imperativePanel.isCollapsed()) {
        imperativePanel.expand();
      }
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [collapsible, panel.collapsed, panelRef]);

  return (
    <ResizablePanel
      {...props}
      collapsible={collapsible}
      panelRef={panelRef}
      onResize={(size, id, previousSize) => {
        onResize?.(size, id, previousSize);
        if (!collapsible) return;

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

type EditorPanelHandleProps = ComponentProps<typeof ResizableHandle>;

function EditorPanelHandle({ onDoubleClick, withHandle, ...props }: EditorPanelHandleProps) {
  const { panel, resetToDefault } = useEditorPanelContext();

  return (
    <ResizableHandle
      {...props}
      withHandle={withHandle ?? !panel.collapsed}
      onDoubleClick={(event) => {
        onDoubleClick?.(event);
        if (!event.defaultPrevented) resetToDefault();
      }}
    />
  );
}

interface EditorPanelRegistration {
  id: string;
  panelId?: EditorPanelId;
}

interface PersistedEditorPanelGroupProps extends Omit<
  ComponentProps<typeof PersistedResizablePanelGroup>,
  "panelIds"
> {
  panels: readonly EditorPanelRegistration[];
}

function PersistedEditorPanelGroup({ panels, ...props }: PersistedEditorPanelGroupProps) {
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

  return <PersistedResizablePanelGroup {...props} panelIds={panelIds} />;
}

interface EditorPanelToggleProps extends Omit<
  ComponentProps<typeof Button>,
  "aria-label" | "aria-pressed" | "children" | "onClick"
> {
  activeIcon: ReactNode;
  activeLabel: string;
  inactiveIcon: ReactNode;
  inactiveLabel: string;
  mode: EditorPanelToggleMode;
  panelId: EditorPanelId;
  tooltipSide?: ComponentProps<typeof TooltipContent>["side"];
}

function EditorPanelToggle({
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
}: EditorPanelToggleProps) {
  const { active, toggle } = useEditorPanelControl(panelId, mode);
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

function useEditorPanelContext() {
  const context = useContext(EditorPanelContext);
  if (!context) {
    throw new Error(
      "EditorPanelContent, EditorPanelHandle, and EditorPanelWhenExpanded must be used within EditorPanel",
    );
  }
  return context;
}

export {
  EditorPanel,
  EditorPanelContent,
  EditorPanelHandle,
  EditorPanelToggle,
  PersistedEditorPanelGroup,
};
export type { EditorPanelRegistration, EditorPanelToggleMode };
