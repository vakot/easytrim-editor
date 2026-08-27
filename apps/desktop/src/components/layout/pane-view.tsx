import { ChevronRight, Eye, EyeOff } from "lucide-react";
import {
  Children,
  createContext,
  Fragment,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";

import { registerPanelSizeReset } from "@/app/panel-layout-runtime";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  panelCollapsedChanged,
  panelVisibilityToggled,
  selectPanel,
  type PanelId,
} from "@/app/store/slices/panel-layout-slice";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  useDefaultLayout,
  useGroupRef,
  type ResizableLayoutStorage,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const DEFAULT_HEADER_SIZE = 28;
const DEFAULT_MIN_SIZE = 120;

interface PaneViewContextValue {
  openIds: readonly string[];
  toggleItem: (id: string) => void;
}

interface PaneViewItemContextValue {
  contentId: string;
  isOpen: boolean;
  itemId: string;
  triggerId: string;
  toggle: () => void;
}

interface ManagedPaneViewContextValue {
  visiblePaneCount: number;
}

const PaneViewContext = createContext<PaneViewContextValue | null>(null);
const PaneViewItemContext = createContext<PaneViewItemContextValue | null>(null);
const ManagedPaneViewContext = createContext<ManagedPaneViewContextValue | null>(null);

interface PaneViewPrimitiveProps {
  children: ReactNode;
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  defaultLayout?: ComponentProps<typeof ResizablePanelGroup>["defaultLayout"];
  groupRef?: ComponentProps<typeof ResizablePanelGroup>["groupRef"];
  onLayoutChanged?: ComponentProps<typeof ResizablePanelGroup>["onLayoutChanged"];
  id?: string;
  className?: string;
  "aria-label"?: string;
}

interface PaneRegistration {
  fixedVisible?: boolean;
  id: string;
  panelId: PanelId;
}

interface PaneViewProps extends Omit<
  PaneViewPrimitiveProps,
  "defaultLayout" | "defaultValue" | "groupRef" | "onLayoutChanged" | "onValueChange" | "value"
> {
  id: string;
  panels: readonly PaneRegistration[];
  storage?: ResizableLayoutStorage;
}

interface PersistedPaneViewProps extends Omit<
  PaneViewPrimitiveProps,
  "defaultLayout" | "id" | "onLayoutChanged"
> {
  id: string;
  panelIds: readonly string[];
  storage?: ResizableLayoutStorage;
}

function PersistedPaneView({ id, panelIds, storage, ...props }: PersistedPaneViewProps) {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id,
    panelIds: [...panelIds],
    storage: storage ?? (typeof localStorage === "undefined" ? undefined : localStorage),
  });

  return (
    <PaneViewPrimitive
      {...props}
      id={id}
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
    />
  );
}

function PaneView(props: PaneViewProps | PaneViewPrimitiveProps) {
  if ("panels" in props) return <ManagedPaneView {...props} />;
  return <PaneViewPrimitive {...props} />;
}

function ManagedPaneView({ children, id, panels, storage, ...props }: PaneViewProps) {
  const dispatch = useAppDispatch();
  const groupRef = useGroupRef();
  const panelStateKey = useAppSelector((state) =>
    panels
      .map((registration) => {
        const panel = selectPanel(state, registration.panelId);
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
  const resetPaneSizes = useCallback(() => {
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
      registerPanelSizeReset({
        groupId: id,
        panelIds: panels.map((panel) => panel.panelId),
        reset: resetPaneSizes,
      }),
    [id, panels, resetPaneSizes],
  );

  const context = useMemo(
    () => ({ visiblePaneCount: visiblePanels.length }),
    [visiblePanels.length],
  );

  return (
    <ManagedPaneViewContext.Provider value={context}>
      <PersistedPaneView
        {...props}
        id={id}
        storage={storage}
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
    </ManagedPaneViewContext.Provider>
  );
}

function PaneViewPrimitive({
  children,
  value,
  defaultValue = [],
  onValueChange,
  defaultLayout,
  groupRef,
  onLayoutChanged,
  id: idProp,
  className,
  "aria-label": ariaLabel,
}: PaneViewPrimitiveProps) {
  const generatedId = useId();
  const groupId = idProp ?? `pane-view-${generatedId}`;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const openIds = value ?? uncontrolledValue;
  const openIdSet = new Set(openIds);
  const items = Children.toArray(children).filter(isPaneViewItem);
  const hasOpenItem = items.some((item) => openIdSet.has(item.props.id));

  const context = useMemo<PaneViewContextValue>(
    () => ({
      openIds,
      toggleItem: (itemId) => {
        const nextValue = openIds.includes(itemId)
          ? openIds.filter((openId) => openId !== itemId)
          : [...openIds, itemId];

        if (value === undefined) setUncontrolledValue(nextValue);
        onValueChange?.(nextValue);
      },
    }),
    [onValueChange, openIds, value],
  );

  return (
    <PaneViewContext.Provider value={context}>
      <ResizablePanelGroup
        id={groupId}
        defaultLayout={defaultLayout}
        groupRef={groupRef}
        onLayoutChanged={onLayoutChanged}
        orientation="vertical"
        aria-label={ariaLabel}
        data-slot="pane-view"
        className={cn("h-full min-h-0", className)}
      >
        {items.map((item, index) => (
          <Fragment key={item.key ?? item.props.id}>
            {index > 0 ? (
              <ResizableHandle
                id={`${groupId}-separator-${index}`}
                aria-label="Resize adjacent sections"
                className="h-1! bg-transparent px-2"
              >
                <Separator />
              </ResizableHandle>
            ) : null}
            {item}
          </Fragment>
        ))}

        <ResizablePanel
          id={`${groupId}-spacer`}
          aria-hidden="true"
          data-slot="pane-view-spacer"
          defaultSize={0}
          minSize={0}
          maxSize={hasOpenItem ? 0 : undefined}
          disabled={hasOpenItem}
          className="min-h-0"
        />
      </ResizablePanelGroup>
    </PaneViewContext.Provider>
  );
}

interface PaneViewItemProps {
  children: ReactNode;
  id: string;
  defaultSize?: number | string;
  headerSize?: number | string;
  minSize?: number | string;
  maxSize?: number | string;
  className?: string;
}

function PaneViewItem({
  children,
  id,
  defaultSize,
  headerSize = DEFAULT_HEADER_SIZE,
  minSize = DEFAULT_MIN_SIZE,
  maxSize,
  className,
}: PaneViewItemProps) {
  const paneView = usePaneViewContext();
  const generatedId = useId();
  const isOpen = paneView.openIds.includes(id);
  const triggerId = `pane-view-trigger-${generatedId}`;
  const contentId = `pane-view-content-${generatedId}`;
  const context = useMemo<PaneViewItemContextValue>(
    () => ({
      contentId,
      isOpen,
      itemId: id,
      triggerId,
      toggle: () => paneView.toggleItem(id),
    }),
    [contentId, id, isOpen, paneView, triggerId],
  );

  return (
    <PaneViewItemContext.Provider value={context}>
      <ResizablePanel
        id={id}
        data-slot="pane-view-item"
        data-state={isOpen ? "open" : "closed"}
        defaultSize={defaultSize}
        disabled={!isOpen}
        minSize={isOpen ? minSize : headerSize}
        maxSize={isOpen ? maxSize : headerSize}
        className={cn("min-h-0", className)}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden">{children}</div>
      </ResizablePanel>
    </PaneViewItemContext.Provider>
  );
}

interface PaneViewTriggerProps extends Omit<
  ComponentProps<typeof Button>,
  "aria-controls" | "aria-expanded"
> {
  fixedWhenAlone?: boolean;
}

function PaneViewTrigger({
  children,
  className,
  fixedWhenAlone = false,
  onClick,
  size = "sm",
  variant = "ghost",
  ...props
}: PaneViewTriggerProps) {
  const item = usePaneViewItemContext();
  const managedPaneView = useContext(ManagedPaneViewContext);

  if (fixedWhenAlone && managedPaneView?.visiblePaneCount === 1) {
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
    <Button
      {...props}
      id={item.triggerId}
      type="button"
      variant={variant}
      size={size}
      aria-controls={item.contentId}
      aria-expanded={item.isOpen}
      data-slot="pane-view-trigger"
      data-state={item.isOpen ? "open" : "closed"}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) item.toggle();
      }}
      className={cn(
        "w-full shrink-0 justify-start text-foreground/80 aria-expanded:bg-transparent aria-expanded:text-foreground/80 aria-expanded:hover:bg-muted aria-expanded:hover:text-foreground",
        className,
      )}
    >
      <ChevronRight
        aria-hidden="true"
        className={cn("self-center transition-transform", item.isOpen && "rotate-90")}
      />
      <span className="min-w-0 truncate">{children}</span>
    </Button>
  );
}

type PaneViewLabelProps = ComponentProps<"span">;

function PaneViewLabel({ children, ...props }: PaneViewLabelProps) {
  const item = usePaneViewItemContext();
  return (
    <span {...props} id={item.triggerId}>
      {children}
    </span>
  );
}

type PaneViewContentProps = Omit<
  ComponentProps<typeof ScrollArea>,
  "aria-labelledby" | "hidden" | "id" | "role"
>;

function PaneViewContent({ className, children, ...props }: PaneViewContentProps) {
  const item = usePaneViewItemContext();
  return (
    <ScrollArea
      {...props}
      id={item.contentId}
      role="region"
      aria-labelledby={item.triggerId}
      hidden={!item.isOpen}
      data-slot="pane-view-content"
      data-state={item.isOpen ? "open" : "closed"}
      className={cn("min-h-0 flex-1", className)}
    >
      {children}
    </ScrollArea>
  );
}

type PaneVisibilityMenuContextType = {
  visibilityKey: string;
  panels: readonly PaneVisibilityMenuItem[];
};

const PaneVisibilityMenuContext = createContext<PaneVisibilityMenuContextType | null>(null);

interface PaneVisibilityMenuItem extends PaneRegistration {
  label: ReactNode;
}

interface PaneVisibilityMenuProps extends React.ComponentProps<typeof Menu> {
  panels: readonly PaneVisibilityMenuItem[];
}

function PaneVisibilityMenu({ panels, ...props }: PaneVisibilityMenuProps) {
  const visibilityKey = useAppSelector((state) =>
    panels
      .map((registration) => {
        const panel = selectPanel(state, registration.panelId);
        return registration.fixedVisible || panel.visible ? "1" : "0";
      })
      .join(""),
  );

  return (
    <PaneVisibilityMenuContext.Provider value={{ visibilityKey, panels }}>
      <Menu {...props} />
    </PaneVisibilityMenuContext.Provider>
  );
}

function PaneVisibilityMenuTrigger(props: React.ComponentProps<typeof MenuTrigger>) {
  return <MenuTrigger {...props} />;
}

function PaneVisibilityMenuContent({ ...props }: React.ComponentProps<typeof MenuContent>) {
  const dispatch = useAppDispatch();
  const { panels, visibilityKey } = usePaneVisibilityMenuContext();

  return (
    <MenuContent {...props}>
      {panels.map((panel, index) => {
        const visible = visibilityKey[index] === "1";
        return (
          <MenuItem
            key={panel.id}
            disabled={panel.fixedVisible}
            icon={
              visible ? (
                <Eye className="size-3" aria-hidden="true" />
              ) : (
                <EyeOff className="size-3" aria-hidden="true" />
              )
            }
            onSelect={(event) => {
              event.preventDefault();
              if (!panel.fixedVisible) dispatch(panelVisibilityToggled(panel.panelId));
            }}
          >
            {panel.label}
          </MenuItem>
        );
      })}
    </MenuContent>
  );
}

function isPaneViewItem(child: ReactNode): child is ReactElement<PaneViewItemProps> {
  return isValidElement(child) && child.type === PaneViewItem;
}

function usePaneViewContext() {
  const context = useContext(PaneViewContext);
  if (!context) throw new Error("PaneViewItem must be used within PaneView");
  return context;
}

function usePaneViewItemContext() {
  const context = useContext(PaneViewItemContext);
  if (!context) {
    throw new Error("PaneViewTrigger and PaneViewContent must be used within PaneViewItem");
  }
  return context;
}

function usePaneVisibilityMenuContext() {
  const context = useContext(PaneVisibilityMenuContext);
  if (!context) {
    throw new Error("PaneVisibilityMenuContent must be used within PaneVisibilityMenu");
  }
  return context;
}

export {
  PaneView,
  PaneViewContent,
  PaneViewItem,
  PaneViewLabel,
  PaneViewTrigger,
  PaneVisibilityMenu,
  PaneVisibilityMenuContent,
  PaneVisibilityMenuTrigger,
  PersistedPaneView,
};
export type { PaneRegistration };
