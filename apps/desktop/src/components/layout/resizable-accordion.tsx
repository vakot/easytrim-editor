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
import { Group, Panel } from "react-resizable-panels";

import { PanelSeparator } from "@/components/layout/panel-separator";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const HEADER_SIZE = 32;
const DEFAULT_MIN_SIZE = 120;

interface ResizableAccordionContextValue {
  openIds: readonly string[];
  toggleItem: (id: string) => void;
}

interface ResizableAccordionItemContextValue {
  contentId: string;
  isOpen: boolean;
  itemId: string;
  triggerId: string;
  toggle: () => void;
}

const ResizableAccordionContext = createContext<ResizableAccordionContextValue | null>(null);
const ResizableAccordionItemContext = createContext<ResizableAccordionItemContextValue | null>(
  null,
);

interface ResizableAccordionProps {
  children: ReactNode;
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  id?: string;
  className?: string;
  "aria-label"?: string;
}

function ResizableAccordion({
  children,
  value,
  defaultValue = [],
  onValueChange,
  id: idProp,
  className,
  "aria-label": ariaLabel,
}: ResizableAccordionProps) {
  const generatedId = useId();
  const groupId = idProp ?? `resizable-accordion-${generatedId}`;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const openIds = value ?? uncontrolledValue;
  const openIdSet = new Set(openIds);
  const items = Children.toArray(children).filter(isResizableAccordionItem);
  const hasOpenItem = items.some((item) => openIdSet.has(item.props.id));

  const context = useMemo<ResizableAccordionContextValue>(
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
    <ResizableAccordionContext.Provider value={context}>
      <Group
        id={groupId}
        orientation="vertical"
        aria-label={ariaLabel}
        data-slot="resizable-accordion"
        className={cn("h-full min-h-0", className)}
        style={
          {
            "--resizable-accordion-header-size": `${HEADER_SIZE}px`,
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

        <Panel
          id={`${groupId}-spacer`}
          aria-hidden="true"
          data-slot="resizable-accordion-spacer"
          defaultSize={0}
          minSize={0}
          maxSize={hasOpenItem ? 0 : undefined}
          disabled={hasOpenItem}
          className="min-h-0"
        />
      </Group>
    </ResizableAccordionContext.Provider>
  );
}

interface ResizableAccordionItemProps {
  children: ReactNode;
  id: string;
  defaultSize?: number | string;
  minSize?: number | string;
  maxSize?: number | string;
  className?: string;
}

function ResizableAccordionItem({
  children,
  id,
  defaultSize,
  minSize = DEFAULT_MIN_SIZE,
  maxSize,
  className,
}: ResizableAccordionItemProps) {
  const accordion = useResizableAccordionContext();
  const generatedId = useId();
  const isOpen = accordion.openIds.includes(id);
  const triggerId = `resizable-accordion-trigger-${generatedId}`;
  const contentId = `resizable-accordion-content-${generatedId}`;
  const context = useMemo<ResizableAccordionItemContextValue>(
    () => ({
      contentId,
      isOpen,
      itemId: id,
      triggerId,
      toggle: () => accordion.toggleItem(id),
    }),
    [accordion, contentId, id, isOpen, triggerId],
  );

  return (
    <ResizableAccordionItemContext.Provider value={context}>
      <Panel
        id={id}
        data-slot="resizable-accordion-item"
        data-state={isOpen ? "open" : "closed"}
        defaultSize={defaultSize}
        disabled={!isOpen}
        minSize={isOpen ? minSize : HEADER_SIZE}
        maxSize={isOpen ? maxSize : HEADER_SIZE}
        className={cn("min-h-0", className)}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden">{children}</div>
      </Panel>
    </ResizableAccordionItemContext.Provider>
  );
}

type ResizableAccordionTriggerProps = Omit<
  ComponentProps<typeof Button>,
  "aria-controls" | "aria-expanded"
>;

function ResizableAccordionTrigger({
  children,
  className,
  onClick,
  size = "sm",
  variant = "ghost",
  ...props
}: ResizableAccordionTriggerProps) {
  const item = useResizableAccordionItemContext();

  return (
    <Button
      {...props}
      id={item.triggerId}
      type="button"
      variant={variant}
      size={size}
      aria-controls={item.contentId}
      aria-expanded={item.isOpen}
      data-slot="resizable-accordion-trigger"
      data-state={item.isOpen ? "open" : "closed"}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) item.toggle();
      }}
      className={cn(
        "h-[var(--resizable-accordion-header-size)] w-full shrink-0 justify-start px-2 text-foreground/80",
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

type ResizableAccordionContentProps = Omit<
  ComponentProps<typeof ScrollArea>,
  "aria-labelledby" | "hidden" | "id" | "role"
>;

function ResizableAccordionContent({
  className,
  children,
  ...props
}: ResizableAccordionContentProps) {
  const item = useResizableAccordionItemContext();

  return (
    <ScrollArea
      {...props}
      id={item.contentId}
      role="region"
      aria-labelledby={item.triggerId}
      hidden={!item.isOpen}
      data-slot="resizable-accordion-content"
      data-state={item.isOpen ? "open" : "closed"}
      className={cn("min-h-0 flex-1", className)}
    >
      {children}
    </ScrollArea>
  );
}

function isResizableAccordionItem(
  child: ReactNode,
): child is ReactElement<ResizableAccordionItemProps> {
  return isValidElement(child) && child.type === ResizableAccordionItem;
}

function useResizableAccordionContext() {
  const context = useContext(ResizableAccordionContext);
  if (!context) {
    throw new Error("ResizableAccordionItem must be used within ResizableAccordion");
  }
  return context;
}

function useResizableAccordionItemContext() {
  const context = useContext(ResizableAccordionItemContext);
  if (!context) {
    throw new Error(
      "ResizableAccordionTrigger and ResizableAccordionContent must be used within ResizableAccordionItem",
    );
  }
  return context;
}

export {
  ResizableAccordion,
  ResizableAccordionContent,
  ResizableAccordionItem,
  ResizableAccordionTrigger,
};
