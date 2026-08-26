import { ChevronDown } from "lucide-react";
import {
  Group,
  Panel,
  type GroupProps,
  type PanelProps,
  usePanelRef,
} from "react-resizable-panels";
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
} from "react";
import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";

import { PanelSeparator } from "@/components/layout/PanelSeparator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

type SectionContextValue = {
  contentId: string;
  open: boolean;
  toggle: () => void;
  triggerId: string;
};

const SectionContext = createContext<SectionContextValue | null>(null);

export interface ResizableSectionsProps extends Omit<GroupProps, "orientation"> {
  children?: ReactNode;
}

export function ResizableSections({ children, className, ...props }: ResizableSectionsProps) {
  const sections = Children.toArray(children).filter(
    (child): child is ReactElement<ResizableSectionProps> =>
      isValidElement(child) && child.type === ResizableSection,
  );

  return (
    <Group
      {...props}
      className={cn("min-h-0", className)}
      orientation="vertical"
      data-slot="resizable-sections"
    >
      {sections.map((section, index) => (
        <ResizableSection
          key={section.key ?? section.props.id}
          {...section.props}
          isLast={index === sections.length - 1}
        />
      ))}
    </Group>
  );
}

export interface ResizableSectionProps {
  children: ReactNode;
  defaultOpen?: boolean;
  defaultSize?: PanelProps["defaultSize"];
  groupResizeBehavior?: PanelProps["groupResizeBehavior"];
  id: string;
  maxSize?: PanelProps["maxSize"];
  minSize?: PanelProps["minSize"];
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  panelClassName?: string;
  separatorLabel?: string;
  isLast?: boolean;
}

export function ResizableSection({
  children,
  defaultOpen = true,
  defaultSize,
  groupResizeBehavior,
  id,
  maxSize,
  minSize,
  onOpenChange,
  open,
  panelClassName,
  separatorLabel = "Resize section",
  isLast = false,
}: ResizableSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const panelRef = usePanelRef();
  const reactId = useId();
  const triggerId = `${id}-trigger`;
  const contentId = `${id}-content`;
  const isOpen = open ?? internalOpen;
  const childElements = Children.toArray(children).filter(isValidElement);
  const trigger = childElements.find((child) => child.type === ResizableSectionTrigger);
  const content = childElements.find((child) => child.type === ResizableSectionContent);
  const triggerProps = trigger?.props as ResizableSectionTriggerProps | undefined;
  const contentProps = content?.props as ResizableSectionContentProps | undefined;

  const setSectionOpen = useCallback(
    (nextOpen: boolean) => {
      if (open === undefined) setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);
      if (nextOpen) {
        panelRef.current?.expand();
      } else {
        panelRef.current?.collapse();
      }
    },
    [onOpenChange, open, panelRef],
  );

  const toggle = useCallback(() => setSectionOpen(!isOpen), [isOpen, setSectionOpen]);

  useEffect(() => {
    if (isOpen) {
      panelRef.current?.expand();
    } else {
      panelRef.current?.collapse();
    }
  }, [isOpen, panelRef]);

  const handleResize = useCallback(
    (size: { asPercentage: number }) => {
      const nextOpen = size.asPercentage > 0;
      if (nextOpen === isOpen) return;
      if (open === undefined) setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [isOpen, onOpenChange, open],
  );

  const contextValue = {
    contentId: `${contentId}-${reactId}`,
    open: isOpen,
    toggle,
    triggerId: `${triggerId}-${reactId}`,
  };

  return (
    <SectionContext.Provider value={contextValue}>
      <Panel
        id={id}
        panelRef={panelRef}
        collapsible
        collapsedSize={36}
        defaultSize={defaultSize}
        minSize={minSize}
        maxSize={maxSize}
        groupResizeBehavior={groupResizeBehavior}
        onResize={handleResize}
        className={cn("min-h-0 min-w-0 overflow-hidden", panelClassName)}
        data-slot="resizable-section-panel"
      >
        <div className="min-h-9 shrink-0" data-slot="resizable-section-trigger-row">
          {trigger ? <ResizableSectionTrigger {...triggerProps} /> : null}
        </div>
        {content ? <ResizableSectionContent {...contentProps} /> : null}
      </Panel>
      {!isLast ? (
        <PanelSeparator
          id={`${id}-separator`}
          label={separatorLabel}
          orientation="horizontal"
          disabled={!isOpen}
          collapsed={!isOpen}
        >
          <Separator />
        </PanelSeparator>
      ) : null}
    </SectionContext.Provider>
  );
}

export type ResizableSectionTriggerProps = ComponentPropsWithoutRef<"button">;

export function ResizableSectionTrigger({
  className,
  children,
  ...props
}: ResizableSectionTriggerProps) {
  const context = useSectionContext();

  return (
    <button
      {...props}
      type="button"
      id={context.triggerId}
      aria-controls={context.contentId}
      aria-expanded={context.open}
      data-state={context.open ? "open" : "closed"}
      className={cn(
        "flex h-9 w-full items-center gap-2 text-left text-xs font-bold tracking-[0.14em] text-primary uppercase transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
        className,
      )}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) context.toggle();
      }}
    >
      <ChevronDown
        aria-hidden="true"
        className={cn("size-3.5 shrink-0 transition-transform", !context.open && "-rotate-90")}
      />
      <span className="truncate">{children}</span>
    </button>
  );
}

export interface ResizableSectionContentProps {
  children?: ReactNode;
  className?: string;
}

export function ResizableSectionContent({ children, className }: ResizableSectionContentProps) {
  const context = useSectionContext();

  return (
    <ScrollArea
      id={context.contentId}
      role="region"
      aria-hidden={!context.open}
      aria-labelledby={context.triggerId}
      hidden={!context.open}
      data-slot="resizable-section-content"
      className={cn("h-full min-h-0 min-w-0 overflow-hidden", className)}
    >
      {children}
    </ScrollArea>
  );
}

function useSectionContext() {
  const context = useContext(SectionContext);
  if (!context) {
    throw new Error(
      "ResizableSectionTrigger and ResizableSectionContent must be used inside ResizableSection",
    );
  }
  return context;
}
