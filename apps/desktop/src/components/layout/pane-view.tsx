import { ChevronRight } from "lucide-react";
import {
  Children,
  createContext,
  Fragment,
  isValidElement,
  useContext,
  useId,
  useMemo,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";

import { PanelSeparator } from "@/components/layout/panel-separator";
import { Button } from "@/components/ui/button";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const HEADER_SIZE = 32;
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

const PaneViewContext = createContext<PaneViewContextValue | null>(null);
const PaneViewItemContext = createContext<PaneViewItemContextValue | null>(null);

interface PaneViewProps {
  children: ReactNode;
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  id?: string;
  className?: string;
  "aria-label"?: string;
}

function PaneView({
  children,
  value,
  defaultValue = [],
  onValueChange,
  id: idProp,
  className,
  "aria-label": ariaLabel,
}: PaneViewProps) {
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
        orientation="vertical"
        aria-label={ariaLabel}
        data-slot="pane-view"
        className={cn("h-full min-h-0", className)}
        style={
          {
            "--pane-view-header-size": `${HEADER_SIZE}px`,
          } as CSSProperties
        }
      >
        {items.map((item, index) => {
          const previousItem = items[index - 1];
          const bothAdjacentItemsCollapsed =
            previousItem !== undefined &&
            !openIdSet.has(previousItem.props.id) &&
            !openIdSet.has(item.props.id);

          return (
            <Fragment key={item.key ?? item.props.id}>
              {index > 0 ? (
                <PanelSeparator
                  id={`${groupId}-separator-${index}`}
                  label="Resize adjacent sections"
                  orientation="horizontal"
                  disabled={bothAdjacentItemsCollapsed}
                />
              ) : null}
              {item}
            </Fragment>
          );
        })}

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
  minSize?: number | string;
  maxSize?: number | string;
  className?: string;
}

function PaneViewItem({
  children,
  id,
  defaultSize,
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
        minSize={isOpen ? minSize : HEADER_SIZE}
        maxSize={isOpen ? maxSize : HEADER_SIZE}
        className={cn("min-h-0", className)}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden">{children}</div>
      </ResizablePanel>
    </PaneViewItemContext.Provider>
  );
}

type PaneViewTriggerProps = Omit<ComponentProps<typeof Button>, "aria-controls" | "aria-expanded">;

function PaneViewTrigger({
  children,
  className,
  onClick,
  size = "sm",
  variant = "ghost",
  ...props
}: PaneViewTriggerProps) {
  const item = usePaneViewItemContext();

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
        "h-[var(--pane-view-header-size)] w-full shrink-0 items-baseline justify-start px-2 text-foreground/80 aria-expanded:bg-transparent aria-expanded:text-foreground/80 aria-expanded:hover:bg-muted aria-expanded:hover:text-foreground",
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

function isPaneViewItem(child: ReactNode): child is ReactElement<PaneViewItemProps> {
  return isValidElement(child) && child.type === PaneViewItem;
}

function usePaneViewContext() {
  const context = useContext(PaneViewContext);
  if (!context) {
    throw new Error("PaneViewItem must be used within PaneView");
  }
  return context;
}

function usePaneViewItemContext() {
  const context = useContext(PaneViewItemContext);
  if (!context) {
    throw new Error("PaneViewTrigger and PaneViewContent must be used within PaneViewItem");
  }
  return context;
}

export { PaneView, PaneViewContent, PaneViewItem, PaneViewTrigger };
