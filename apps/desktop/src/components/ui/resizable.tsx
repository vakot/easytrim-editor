"use client";

import * as React from "react";
import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";

type PanelId = string;
type PanelRef = React.RefObject<ResizablePrimitive.PanelImperativeHandle | null>;
type PanelState = { ref: PanelRef; isCollapsed: boolean };

type PanelRefsCollection = Record<PanelId, PanelState>;

const ResizablePanelContext = React.createContext<{
  panels: PanelRefsCollection;
  registerPanel: (panelId: PanelId, panelRef: PanelRef) => void;
  unregisterPanel: (panelId: PanelId) => void;
  updatePanelState: (panelId: PanelId, update: (panel: PanelState) => PanelState) => void;
} | null>(null);

type ResizablePanelGroupProps =
  | ({ persisted: true } & PersistedResizablePanelGroupProps)
  | ({ persisted?: false } & ResizablePrimitive.GroupProps);

function ResizablePanelGroup({ persisted, ...props }: ResizablePanelGroupProps) {
  if (!persisted) return <ResizablePrimitive.Group {...props} />;
  return <ResizablePanelGroupPersisted {...(props as PersistedResizablePanelGroupProps)} />;
}

type ResizableLayoutStorage = ResizablePrimitive.LayoutStorage;

interface PersistedResizablePanelGroupProps extends Omit<
  ResizablePrimitive.GroupProps,
  "defaultLayout" | "id"
> {
  id: string;
  storage?: ResizablePrimitive.LayoutStorage;
}

function ResizablePanelGroupPersisted({
  id,
  storage,
  onLayoutChanged,
  children,
  ...props
}: PersistedResizablePanelGroupProps) {
  const panelIds = getPanelIds(children);

  const persistedLayout = ResizablePrimitive.useDefaultLayout({
    id,
    panelIds: panelIds ?? [],
    storage: storage ?? (typeof localStorage === "undefined" ? undefined : localStorage),
  });

  return (
    <ResizablePanelGroupBase
      {...props}
      id={id}
      defaultLayout={persistedLayout.defaultLayout}
      onLayoutChanged={(layout, meta) => {
        persistedLayout.onLayoutChanged(layout, meta);
        onLayoutChanged?.(layout, meta);
      }}
    >
      {children}
    </ResizablePanelGroupBase>
  );
}

function ResizablePanelGroupBase({ className, ...props }: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn("flex h-full w-full aria-[orientation=vertical]:flex-col", className)}
      {...props}
    />
  );
}

interface ResizablePanelProps extends Omit<ResizablePrimitive.PanelProps, "id"> {
  id: PanelId;
}

function ResizablePanel({ id, onResize, ...props }: ResizablePanelProps) {
  const { registerPanel, unregisterPanel, updatePanelState } = useResizablePanelContext();

  const panelRef = ResizablePrimitive.usePanelRef();

  React.useEffect(() => {
    registerPanel(id, panelRef);
    return () => unregisterPanel(id);
  }, [id, panelRef, registerPanel, unregisterPanel]);

  return (
    <ResizablePrimitive.Panel
      data-slot="resizable-panel"
      id={id}
      panelRef={panelRef}
      onResize={(size, panelId, prevSize) => {
        const isCollapsed = panelRef.current?.isCollapsed() ?? false;

        updatePanelState(id, (currentPanel) => {
          if (currentPanel.isCollapsed === isCollapsed) return currentPanel;

          return {
            ...currentPanel,
            isCollapsed,
          };
        });

        onResize?.(size, panelId, prevSize);
      }}
      {...props}
    />
  );
}

function ResizableHandle({
  withHandle,
  className,
  children,
  "aria-orientation": orientation,
  ...props
}: ResizablePrimitive.SeparatorProps & {
  withHandle?: boolean;
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      aria-orientation={orientation}
      className={cn(
        "relative flex w-px items-center justify-center bg-border ring-offset-background after:pointer-events-none after:absolute after:top-1/2 after:left-1/2 after:z-20 after:h-1 after:w-1 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded after:bg-transparent focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden data-[separator='hover']:after:bg-primary/70 data-[separator='active']:after:bg-primary aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:w-full aria-[orientation=vertical]:h-full aria-[orientation=vertical]:w-px aria-[orientation=vertical]:after:h-full [&[aria-orientation=vertical]>div]:rotate-90",
        className,
      )}
      {...props}
    >
      {children ??
        (withHandle ? <div className="z-10 flex w-6 h-0.5 shrink-0 rounded-lg bg-border" /> : null)}
    </ResizablePrimitive.Separator>
  );
}

interface ResizablePanelToggleProps {
  mode?: "collapsed" | "visible";
  panelId: string;
  children?: React.ReactNode | ((collapsed: boolean) => React.ReactNode);
}

function ResizablePanelToggle({ panelId, children }: ResizablePanelToggleProps) {
  const panelState = usePanelState(panelId);

  const toggle = () => {
    const panel = panelState?.ref.current;
    if (!panel) return;

    if (panelState.isCollapsed) {
      panel.expand();
    } else {
      panel.collapse();
    }
  };

  const child =
    typeof children === "function" ? children(panelState?.isCollapsed ?? false) : children;

  return <Slot.Root onClick={toggle}>{child}</Slot.Root>;
}

function ResizablePanelContextProvider({ children }: React.PropsWithChildren) {
  const [panels, setPanels] = React.useState<PanelRefsCollection>({});

  const registerPanel = React.useCallback((panelId: PanelId, panelRef: PanelRef) => {
    setPanels((panels) => ({
      ...panels,
      [panelId]: {
        ref: panelRef,
        isCollapsed: panelRef.current?.isCollapsed() ?? false,
        isDisabled: false,
        restoreState: "idle",
      },
    }));
  }, []);

  const unregisterPanel = React.useCallback((panelId: PanelId) => {
    setPanels((panels) => {
      const next = { ...panels };
      delete next[panelId];
      return next;
    });
  }, []);

  const updatePanelState = React.useCallback(
    (panelId: PanelId, update: (panel: PanelState) => PanelState) => {
      setPanels((panels) => {
        const panel = panels[panelId];
        if (!panel) return panels;

        const nextPanel = update(panel);
        if (nextPanel === panel) return panels;

        return {
          ...panels,
          [panelId]: nextPanel,
        };
      });
    },
    [],
  );

  return (
    <ResizablePanelContext.Provider
      value={{ panels, registerPanel, unregisterPanel, updatePanelState }}
    >
      {children}
    </ResizablePanelContext.Provider>
  );
}

function getPanelIds(children: React.ReactNode): PanelId[] {
  return React.Children.toArray(children)
    .filter(
      (child): child is React.ReactElement<React.ComponentProps<typeof ResizablePanel>> =>
        React.isValidElement(child) && child.type === ResizablePanel,
    )
    .map((panel) => {
      if (!panel.props.id) {
        throw new Error(
          "ResizablePanel must have an id when used within PersistedResizablePanelGroup",
        );
      }

      return panel.props.id;
    });
}

function useResizablePanelContext() {
  const context = React.useContext(ResizablePanelContext);
  if (!context) {
    throw new Error("ResizablePanel must be used within ResizablePanelContextProvider");
  }
  return context;
}

function usePanelState(panelId: PanelId) {
  const { panels } = useResizablePanelContext();
  return panels[panelId];
}

const usePanelRef = ResizablePrimitive.usePanelRef;
const useGroupRef = ResizablePrimitive.useGroupRef;
const useDefaultLayout = ResizablePrimitive.useDefaultLayout;

export {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelContextProvider,
  ResizablePanelGroup,
  ResizablePanelToggle,
  useDefaultLayout,
  useGroupRef,
  usePanelRef,
};
export type { ResizableLayoutStorage };
