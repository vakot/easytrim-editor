import { Eye, EyeOff } from "lucide-react";
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ComponentProps,
  type ReactNode,
} from "react";

import { registerEditorPanelSizeReset } from "@/app/editor-layout-runtime";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  panelCollapsedChanged,
  panelVisibilityToggled,
  selectEditorPanel,
  type EditorPanelId,
} from "@/app/store/slices/editor-layout-slice";
import { PaneViewLabel, PaneViewTrigger, PersistedPaneView } from "@/components/layout/pane-view";
import { ContextMenu, type ContextMenuOption } from "@/components/ui/context-menu";
import { useGroupRef } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

interface EditorPaneRegistration {
  fixedVisible?: boolean;
  id: string;
  panelId: EditorPanelId;
}

interface EditorPaneViewContextValue {
  visiblePaneCount: number;
}

const EditorPaneViewContext = createContext<EditorPaneViewContextValue | null>(null);

interface EditorPaneViewProps extends Omit<
  ComponentProps<typeof PersistedPaneView>,
  "defaultValue" | "groupRef" | "onValueChange" | "panelIds" | "value"
> {
  panels: readonly EditorPaneRegistration[];
}

function EditorPaneView({ children, id, panels, ...props }: EditorPaneViewProps) {
  const dispatch = useAppDispatch();
  const groupRef = useGroupRef();
  const panelStateKey = useAppSelector((state) =>
    panels
      .map((registration) => {
        const panel = selectEditorPanel(state, registration.panelId);
        return `${registration.fixedVisible || panel.visible ? "1" : "0"}${panel.collapsed ? "1" : "0"}`;
      })
      .join(""),
  );
  const panelStates = useMemo(
    () =>
      panels.map((panel, index) => ({
        ...panel,
        collapsed: panelStateKey[index * 2 + 1] === "1",
        visible: panelStateKey[index * 2] === "1",
      })),
    [panelStateKey, panels],
  );
  const visiblePanels = useMemo(() => panelStates.filter((panel) => panel.visible), [panelStates]);
  const openPaneIds = useMemo(
    () => visiblePanels.filter((panel) => !panel.collapsed).map((panel) => panel.id),
    [visiblePanels],
  );
  const persistedPanelIds = useMemo(
    () => [...visiblePanels.map((panel) => panel.id), `${id}-spacer`],
    [id, visiblePanels],
  );
  const visiblePaneIdSet = useMemo(
    () => new Set(visiblePanels.map((panel) => panel.id)),
    [visiblePanels],
  );
  const visibleChildren = Children.toArray(children).filter(
    (child) =>
      isValidElement<{ id?: unknown }>(child) &&
      typeof child.props.id === "string" &&
      visiblePaneIdSet.has(child.props.id),
  );
  const resetPanelSizes = useCallback(() => {
    const size = visiblePanels.length > 0 ? 100 / visiblePanels.length : 0;
    groupRef.current?.setLayout(
      Object.fromEntries([
        ...visiblePanels.map((panel) => [panel.id, size]),
        [`${id}-spacer`, visiblePanels.length > 0 ? 0 : 100],
      ]),
    );
  }, [groupRef, id, visiblePanels]);

  useEffect(
    () =>
      registerEditorPanelSizeReset({
        panelIds: panels.map((panel) => panel.panelId),
        reset: resetPanelSizes,
      }),
    [panels, resetPanelSizes],
  );

  const context = useMemo(
    () => ({ visiblePaneCount: visiblePanels.length }),
    [visiblePanels.length],
  );

  return (
    <EditorPaneViewContext.Provider value={context}>
      <PersistedPaneView
        {...props}
        id={id}
        panelIds={persistedPanelIds}
        groupRef={groupRef}
        value={openPaneIds}
        onValueChange={(nextOpenPaneIds) => {
          visiblePanels.forEach((panel) => {
            const collapsed = !nextOpenPaneIds.includes(panel.id);
            if (collapsed !== panel.collapsed) {
              dispatch(panelCollapsedChanged({ panelId: panel.panelId, collapsed }));
            }
          });
        }}
      >
        {visibleChildren}
      </PersistedPaneView>
    </EditorPaneViewContext.Provider>
  );
}

interface EditorPaneViewTriggerProps extends ComponentProps<typeof PaneViewTrigger> {
  fixedWhenAlone?: boolean;
}

function EditorPaneViewTrigger({
  children,
  className,
  fixedWhenAlone = false,
  ...props
}: EditorPaneViewTriggerProps) {
  const { visiblePaneCount } = useEditorPaneViewContext();

  if (fixedWhenAlone && visiblePaneCount === 1) {
    return (
      <PaneViewLabel
        className={cn(
          "mx-2 inline-flex h-6 shrink-0 items-center text-xs font-medium whitespace-nowrap text-foreground/80",
          className,
        )}
      >
        {children}
      </PaneViewLabel>
    );
  }

  return (
    <PaneViewTrigger className={className} {...props}>
      {children}
    </PaneViewTrigger>
  );
}

interface EditorPaneVisibilityMenuItem extends EditorPaneRegistration {
  label: ReactNode;
}

interface EditorPaneVisibilityMenuProps {
  "aria-label"?: string;
  children: ReactNode;
  className?: string;
  panels: readonly EditorPaneVisibilityMenuItem[];
}

function EditorPaneVisibilityMenu({
  children,
  className,
  panels,
  "aria-label": ariaLabel,
}: EditorPaneVisibilityMenuProps) {
  const dispatch = useAppDispatch();
  const visibilityKey = useAppSelector((state) =>
    panels
      .map((registration) => {
        const panel = selectEditorPanel(state, registration.panelId);
        return registration.fixedVisible || panel.visible ? "1" : "0";
      })
      .join(""),
  );
  const options: ContextMenuOption[] = panels.map((panel, index) => {
    const visible = visibilityKey[index] === "1";

    return {
      id: `toggle-${panel.id}`,
      children: panel.label,
      icon: visible ? (
        <Eye className="size-3" aria-hidden="true" />
      ) : (
        <EyeOff className="size-3" aria-hidden="true" />
      ),
      disabled: panel.fixedVisible,
      shouldCloseOnClick: false,
      onSelect: panel.fixedVisible
        ? undefined
        : () => dispatch(panelVisibilityToggled(panel.panelId)),
    };
  });

  return (
    <ContextMenu options={options} className={className} aria-label={ariaLabel}>
      {children}
    </ContextMenu>
  );
}

function useEditorPaneViewContext() {
  const context = useContext(EditorPaneViewContext);
  if (!context) {
    throw new Error("EditorPaneViewTrigger must be used within EditorPaneView");
  }
  return context;
}

export { EditorPaneView, EditorPaneViewTrigger, EditorPaneVisibilityMenu };
export type { EditorPaneRegistration };
