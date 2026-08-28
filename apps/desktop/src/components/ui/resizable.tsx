"use client";

import * as React from "react";
import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";

type PanelId = string;
type PanelRef = React.RefObject<ResizablePrimitive.PanelImperativeHandle | null>;
type PanelState = {
  ref: PanelRef;
  isCollapsed: boolean;
  isDisabled: boolean;
  previousSize?: number;
  pendingRestore: boolean;
};

type PanelRefsCollection = Record<PanelId, PanelState>;

const ResizablePanelContext = React.createContext<{
  panels: PanelRefsCollection;
  registerPanel: (panelId: PanelId, panelRef: PanelRef) => void;
  unregisterPanel: (panelId: PanelId) => void;
  updatePanelState: (panelId: PanelId, update: (panel: PanelState) => PanelState) => void;
  requestPanelRestore: (panelId: PanelId) => void;
  finishPanelRestore: (panelId: PanelId) => void;
} | null>(null);

function ResizablePanelGroup({ className, ...props }: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn("flex h-full w-full aria-[orientation=vertical]:flex-col", className)}
      {...props}
    />
  );
}

interface PersistedResizablePanelGroupProps extends Omit<
  ResizablePrimitive.GroupProps,
  "defaultLayout" | "id"
> {
  id: string;
  storage?: ResizablePrimitive.LayoutStorage;
}

type ResizableLayoutStorage = ResizablePrimitive.LayoutStorage;

function PersistedResizablePanelGroup({
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
    <ResizablePanelGroup
      {...props}
      id={id}
      defaultLayout={persistedLayout.defaultLayout}
      onLayoutChanged={(layout, meta) => {
        persistedLayout.onLayoutChanged(layout, meta);
        onLayoutChanged?.(layout, meta);
      }}
    >
      {children}
    </ResizablePanelGroup>
  );
}

interface ResizablePanelProps extends Omit<ResizablePrimitive.PanelProps, "id"> {
  id: PanelId;
  collapsibleMode?: "default" | "forced";
}

function ResizablePanel({
  id,
  collapsibleMode = "default",
  onResize,
  minSize,
  maxSize,
  collapsedSize,
  disabled,
  ...props
}: ResizablePanelProps) {
  const { registerPanel, unregisterPanel, updatePanelState, finishPanelRestore } =
    useResizablePanelContext();

  const panel = usePanelState(id);
  const panelRef = ResizablePrimitive.usePanelRef();
  const isForced = collapsibleMode === "forced";
  const isForcedDisabled = isForced && panel?.isDisabled;
  const lockedSize = collapsedSize ?? 0;

  React.useEffect(() => {
    registerPanel(id, panelRef);
    return () => unregisterPanel(id);
  }, [id, panelRef, registerPanel, unregisterPanel]);

  React.useEffect(() => {
    if (!isForced || !panel?.pendingRestore || panel.isDisabled) return;

    if (panel.previousSize == null) {
      panelRef.current?.expand();
    } else {
      panelRef.current?.resize(`${panel.previousSize}%`);
    }

    finishPanelRestore(id);
  }, [
    finishPanelRestore,
    id,
    isForced,
    panel?.isDisabled,
    panel?.pendingRestore,
    panel?.previousSize,
    panelRef,
  ]);

  React.useEffect(() => {
    if (isForced && panel?.pendingRestore) return;

    updatePanelState(id, (currentPanel) => {
      const isInitiallyCollapsed = panelRef.current?.isCollapsed() ?? false;

      if (isForced) {
        if (!isInitiallyCollapsed || currentPanel.isDisabled) return currentPanel;

        return {
          ...currentPanel,
          isCollapsed: true,
          isDisabled: true,
        };
      }

      if (!currentPanel.isDisabled && !currentPanel.pendingRestore) return currentPanel;

      return {
        ...currentPanel,
        isDisabled: false,
        pendingRestore: false,
      };
    });
  }, [id, isForced, panel?.pendingRestore, panel?.ref, panelRef, updatePanelState]);

  return (
    <ResizablePrimitive.Panel
      data-slot="resizable-panel"
      id={id}
      panelRef={panelRef}
      disabled={isForcedDisabled ? true : disabled}
      minSize={isForcedDisabled ? lockedSize : minSize}
      maxSize={isForcedDisabled ? lockedSize : maxSize}
      collapsedSize={collapsedSize}
      onResize={(size, panelId, prevSize) => {
        const isCollapsed = panelRef.current?.isCollapsed() ?? false;

        updatePanelState(id, (currentPanel) => {
          const isDisabled = isForced ? isCollapsed : currentPanel.isDisabled;
          const previousSize = isForced && !isCollapsed ? size.asPercentage : undefined;

          if (
            currentPanel.isCollapsed === isCollapsed &&
            currentPanel.isDisabled === isDisabled &&
            (previousSize == null || currentPanel.previousSize === previousSize)
          ) {
            return currentPanel;
          }

          return {
            ...currentPanel,
            isCollapsed,
            isDisabled,
            ...(previousSize == null ? {} : { previousSize }),
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
  const { requestPanelRestore } = useResizablePanelContext();

  const toggle = () => {
    const panel = panelState?.ref.current;
    if (!panel) return;

    if (panelState.isDisabled) {
      requestPanelRestore(panelId);
    } else if (panel.isCollapsed()) {
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
        pendingRestore: false,
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

  const requestPanelRestore = React.useCallback((panelId: PanelId) => {
    setPanels((panels) => {
      const panel = panels[panelId];
      if (!panel || (!panel.isDisabled && panel.pendingRestore)) return panels;

      return {
        ...panels,
        [panelId]: {
          ...panel,
          isDisabled: false,
          pendingRestore: true,
        },
      };
    });
  }, []);

  const finishPanelRestore = React.useCallback((panelId: PanelId) => {
    setPanels((panels) => {
      const panel = panels[panelId];
      if (!panel?.pendingRestore) return panels;

      return {
        ...panels,
        [panelId]: {
          ...panel,
          pendingRestore: false,
        },
      };
    });
  }, []);

  return (
    <ResizablePanelContext.Provider
      value={{
        panels,
        registerPanel,
        unregisterPanel,
        updatePanelState,
        requestPanelRestore,
        finishPanelRestore,
      }}
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
  PersistedResizablePanelGroup,
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
