import { ChevronDown } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Children, createContext, isValidElement, useCallback, useContext, useState } from "react";
import {
  Group,
  Panel,
  usePanelRef,
  type GroupProps,
  type PanelProps,
} from "react-resizable-panels";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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
  return (
    <Group
      {...props}
      className={cn("min-h-0", className)}
      orientation="vertical"
      data-slot="resizable-sections"
    >
      {children}
    </Group>
  );
}

type PanelPropsToPick =
  "children" | "defaultSize" | "groupResizeBehavior" | "minSize" | "className" | "id";

export interface ResizableSectionProps extends Pick<PanelProps, PanelPropsToPick> {
  defaultOpen?: boolean;
}

export function ResizableSection({
  children,
  defaultOpen = true,
  defaultSize,
  groupResizeBehavior,
  id,
  minSize,
  className,
}: ResizableSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelRef = usePanelRef();
  const triggerId = `${id}-trigger`;
  const contentId = `${id}-content`;
  const childElements = Children.toArray(children).filter(isValidElement);
  const trigger = childElements.find((child) => child.type === ResizableSectionTrigger);
  const content = childElements.find((child) => child.type === ResizableSectionContent);
  const triggerProps = trigger?.props as ResizableSectionTriggerProps | undefined;
  const contentProps = content?.props as ResizableSectionContentProps | undefined;

  const syncOpenState = useCallback((nextOpen: boolean) => {
    setOpen((currentOpen) => (currentOpen === nextOpen ? currentOpen : nextOpen));
  }, []);

  const toggle = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;

    if (panel.isCollapsed()) {
      panel.expand();
      syncOpenState(true);
    } else {
      panel.collapse();
      syncOpenState(false);
    }
  }, [panelRef, syncOpenState]);

  const handleResize = useCallback(() => {
    const isCollapsed = panelRef.current?.isCollapsed();
    if (isCollapsed !== undefined) syncOpenState(!isCollapsed);
  }, [panelRef, syncOpenState]);

  const contextValue = {
    contentId,
    open,
    toggle,
    triggerId,
  };

  return (
    <SectionContext.Provider value={contextValue}>
      <Panel
        id={id}
        panelRef={panelRef}
        collapsible
        collapsedSize={24}
        defaultSize={defaultOpen ? defaultSize : 24}
        minSize={minSize}
        groupResizeBehavior={groupResizeBehavior}
        onResize={handleResize}
        className={className}
        style={{ overflow: "hidden" }}
        data-slot="resizable-section-panel"
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          {trigger ? <ResizableSectionTrigger {...triggerProps} /> : null}
          {content ? <ResizableSectionContent {...contentProps} /> : null}
        </div>
      </Panel>
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
      data-slot="resizable-section-trigger-row"
      className={cn(
        "flex h-6 w-full items-center gap-2 transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
        className,
      )}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) context.toggle();
      }}
    >
      <ChevronDown
        aria-hidden="true"
        className={cn("size-3 shrink-0 transition-transform", !context.open && "-rotate-90")}
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
      aria-labelledby={context.triggerId}
      hidden={!context.open}
      data-slot="resizable-section-content"
      className={cn("min-h-0 flex-1", className)}
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
