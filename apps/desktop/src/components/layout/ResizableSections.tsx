import { ChevronDown } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Group,
  Panel,
  usePanelRef,
  type GroupProps,
  type Layout,
  type LayoutChangedMeta,
  type PanelImperativeHandle,
  type PanelProps,
} from "react-resizable-panels";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type SectionContextValue = {
  contentId: string;
  open: boolean;
  toggle: () => void;
  triggerId: string;
};

const SectionContext = createContext<SectionContextValue | null>(null);

type SectionRegistration = {
  open: boolean;
  panelRef: React.RefObject<PanelImperativeHandle | null>;
};

type SectionsContextValue = {
  sectionStates: Record<string, boolean>;
  registerSection: (id: string | number | undefined, registration: SectionRegistration) => void;
  setSectionState: (id: string | number | undefined, open: boolean) => void;
  unregisterSection: (id: string | number | undefined) => void;
};

const SectionsContext = createContext<SectionsContextValue | null>(null);

export interface ResizableSectionsProps extends Omit<GroupProps, "orientation"> {
  children?: ReactNode;
}

export function ResizableSections({
  children,
  className,
  onLayoutChanged,
  ...props
}: ResizableSectionsProps) {
  const [sectionStates, setSectionStates] = useState<Record<string, boolean>>({});
  const sectionRegistrations = useRef(new Map<string, SectionRegistration>());
  const fillerRef = usePanelRef();
  const fillerId = `${useId()}-filler`;
  const sectionCount = Object.keys(sectionStates).length;
  const hasOpenUserSection = Object.values(sectionStates).some(Boolean);

  const registerSection = useCallback(
    (id: string | number | undefined, registration: SectionRegistration) => {
      const key = String(id);
      sectionRegistrations.current.set(key, registration);
      setSectionStates((current) =>
        key in current ? current : { ...current, [key]: registration.open },
      );
    },
    [],
  );

  const setSectionState = useCallback((id: string | number | undefined, open: boolean) => {
    const key = String(id);
    setSectionStates((current) => (current[key] === open ? current : { ...current, [key]: open }));
  }, []);

  const unregisterSection = useCallback((id: string | number | undefined) => {
    const key = String(id);
    sectionRegistrations.current.delete(key);
    setSectionStates((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const syncSectionStatesFromLayout = useCallback((_layout: Layout, meta: LayoutChangedMeta) => {
    if (!meta.isUserInteraction) return;

    setSectionStates((current) => {
      let next = current;

      for (const [id, { panelRef }] of sectionRegistrations.current) {
        const isCollapsed = panelRef.current?.isCollapsed();
        if (isCollapsed === undefined) continue;

        const open = !isCollapsed;
        if (next[id] !== open) {
          if (next === current) next = { ...current };
          next[id] = open;
        }
      }

      return next;
    });
  }, []);

  const handleLayoutChanged = useCallback(
    (layout: Layout, meta: LayoutChangedMeta) => {
      onLayoutChanged?.(layout, meta);
      syncSectionStatesFromLayout(layout, meta);
    },
    [onLayoutChanged, syncSectionStatesFromLayout],
  );

  useEffect(() => {
    if (sectionCount === 0) return;

    const filler = fillerRef.current;
    if (!filler) return;

    if (hasOpenUserSection) {
      filler.collapse();
    } else {
      filler.expand();
    }
  }, [fillerRef, hasOpenUserSection, sectionCount]);

  const sectionsContextValue = useMemo(
    () => ({ registerSection, sectionStates, setSectionState, unregisterSection }),
    [registerSection, sectionStates, setSectionState, unregisterSection],
  );

  return (
    <SectionsContext.Provider value={sectionsContextValue}>
      <Group
        {...props}
        className={cn("min-h-0", className)}
        onLayoutChanged={handleLayoutChanged}
        orientation="vertical"
        data-slot="resizable-sections"
      >
        {children}
        <Panel
          id={fillerId}
          panelRef={fillerRef}
          collapsible
          collapsedSize="0%"
          defaultSize="100%"
          aria-hidden="true"
          data-slot="resizable-sections-filler"
        />
      </Group>
    </SectionsContext.Provider>
  );
}

type PanelPropsToPick =
  | "children"
  | "defaultSize"
  | "groupResizeBehavior"
  | "minSize"
  | "collapsedSize"
  | "className"
  | "id";

export interface ResizableSectionProps extends Pick<PanelProps, PanelPropsToPick> {
  defaultOpen?: boolean;
}

export function ResizableSection({
  children,
  defaultOpen = true,
  collapsedSize = 24, // h-6
  defaultSize,
  groupResizeBehavior,
  id,
  minSize,
  className,
}: ResizableSectionProps) {
  const initialOpen = useRef(defaultOpen);
  const sectionsContext = useSectionsContext();
  const { registerSection, sectionStates, setSectionState, unregisterSection } = sectionsContext;
  const sectionKey = String(id);
  const open = sectionStates[sectionKey] ?? defaultOpen;
  const panelRef = usePanelRef();
  const triggerId = `${id}-trigger`;
  const contentId = `${id}-content`;
  const childElements = Children.toArray(children).filter(isValidElement);
  const trigger = childElements.find((child) => child.type === ResizableSectionTrigger);
  const content = childElements.find((child) => child.type === ResizableSectionContent);
  const triggerProps = trigger?.props as ResizableSectionTriggerProps | undefined;
  const contentProps = content?.props as ResizableSectionContentProps | undefined;

  const toggle = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;

    if (open) {
      setSectionState(id, false);
      panel.collapse();
    } else {
      setSectionState(id, true);
      panel.expand();
    }
  }, [id, open, panelRef, setSectionState]);

  useEffect(() => {
    registerSection(id, { open: initialOpen.current, panelRef });
    return () => unregisterSection(id);
  }, [id, panelRef, registerSection, unregisterSection]);

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
        collapsedSize={collapsedSize}
        defaultSize={defaultOpen ? defaultSize : collapsedSize}
        minSize={minSize}
        groupResizeBehavior={groupResizeBehavior}
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

export type ResizableSectionTriggerProps = ComponentPropsWithoutRef<typeof Button>;

export function ResizableSectionTrigger({
  className,
  children,
  ...props
}: ResizableSectionTriggerProps) {
  const context = useSectionContext();

  return (
    <Button
      {...props}
      type="button"
      id={context.triggerId}
      aria-controls={context.contentId}
      aria-expanded={context.open}
      data-state={context.open ? "open" : "closed"}
      data-slot="resizable-section-trigger-row"
      className={cn("justify-baseline text-foreground/80", className)}
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
    </Button>
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

function useSectionsContext() {
  const context = useContext(SectionsContext);
  if (!context) {
    throw new Error("ResizableSection must be used inside ResizableSections");
  }
  return context;
}
