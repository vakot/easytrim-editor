"use client";

import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/lib/utils";

function ResizablePanelGroup({ className, ...props }: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn("flex h-full w-full aria-[orientation=vertical]:flex-col", className)}
      {...props}
    />
  );
}

type PersistedResizablePanelGroupProps = Omit<
  ResizablePrimitive.GroupProps,
  "defaultLayout" | "id"
> & {
  id: string;
  panelIds: readonly string[];
  storage?: ResizablePrimitive.LayoutStorage;
};

type ResizableLayoutStorage = ResizablePrimitive.LayoutStorage;

function PersistedResizablePanelGroup({
  id,
  panelIds,
  storage,
  onLayoutChanged,
  ...props
}: PersistedResizablePanelGroupProps) {
  const persistedLayout = ResizablePrimitive.useDefaultLayout({
    id,
    panelIds: [...panelIds],
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
    />
  );
}

function ResizablePanel(props: ResizablePrimitive.PanelProps) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
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

const usePanelRef = ResizablePrimitive.usePanelRef;
const useGroupRef = ResizablePrimitive.useGroupRef;
const useDefaultLayout = ResizablePrimitive.useDefaultLayout;

export {
  PersistedResizablePanelGroup,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  useDefaultLayout,
  useGroupRef,
  usePanelRef,
};
export type { ResizableLayoutStorage };
