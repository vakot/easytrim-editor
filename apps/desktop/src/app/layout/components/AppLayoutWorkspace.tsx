import { useDroppable } from "@dnd-kit/react";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

import { AppLayoutMain } from "@/app/layout/components/AppLayoutMain";
import { AppLayoutPanel } from "@/app/layout/components/AppLayoutPanel";
import { AppLayoutSidebar, SidebarEmptyDropTarget } from "@/app/layout/components/AppLayoutSidebar";
import type {
  SidebarDropPlacement,
  SidebarLayout,
  SidebarViewId,
} from "@/app/layout/lib/sidebar-layout";
import type { SidebarViewHosts } from "@/app/layout/lib/sidebar-view-hosts";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectLayoutDensity } from "@/app/store/slices/preferences-slice";
import { cn } from "@/lib/class-names.utils";

import { useSidebarPresence } from "../hooks/useSidebarPresence";
import type { SidebarVisibility } from "../hooks/useSidebarVisibility";
import { useWorkspaceSidebarWidths } from "../hooks/useWorkspaceSidebarWidths";

interface AppLayoutWorkspaceProps {
  dragPreviewViewId: SidebarViewId | null;
  dropPlacement: SidebarDropPlacement | null;
  isDraggingView: boolean;
  sidebarLayout: SidebarLayout;
  sidebarVisibility: SidebarVisibility;
  viewHosts: SidebarViewHosts;
}

function AppLayoutWorkspace({
  dragPreviewViewId,
  dropPlacement,
  isDraggingView,
  sidebarLayout,
  sidebarVisibility,
  viewHosts,
}: AppLayoutWorkspaceProps) {
  const isCompact = useAppSelector(selectLayoutDensity) === "compact";
  const leftSidebarPresence = useSidebarPresence("left", sidebarVisibility.hasLeftSidebar);
  const rightSidebarPresence = useSidebarPresence("right", sidebarVisibility.hasRightSidebar);
  const { handleWorkspaceLayoutChanged, workspaceSidebarWidths } = useWorkspaceSidebarWidths({
    left: sidebarVisibility.hasLeftSidebar,
    resizeSidebar: sidebarVisibility.resizeSidebar,
    right: sidebarVisibility.hasRightSidebar,
  });

  return (
    <div className="relative min-h-0 min-w-0">
      <ResizablePanelGroup
        className="*:data-panel:transition-[flex-grow,flex-basis] *:data-panel:duration-200 *:data-panel:ease-out has-data-[separator=active]:*:data-panel:transition-none motion-reduce:*:data-panel:transition-none"
        id="workspace"
        onLayoutChanged={handleWorkspaceLayoutChanged}
        onlySaveAfterUserInteractions
        persisted
      >
        {leftSidebarPresence.isMounted ? (
          <WorkspaceSidebar
            draggingViewId={dragPreviewViewId}
            dropPlacement={dropPlacement}
            side="left"
            viewHosts={viewHosts}
            views={sidebarLayout.left}
            width={workspaceSidebarWidths.left ?? "20.5rem"}
          />
        ) : null}

        {leftSidebarPresence.isMounted ? (
          <AppLayoutSeparator
            isClosing={leftSidebarPresence.isClosing}
            isCollapsed={!sidebarVisibility.leftSidebarVisible}
            isCompact={isCompact}
          />
        ) : null}

        <ResizablePanel
          className={cn(
            "overflow-hidden! transition-[margin] duration-200 ease-out motion-reduce:transition-none",
            !sidebarVisibility.hasLeftSidebar && "ml-1.5",
            !sidebarVisibility.hasRightSidebar && "mr-1.5",
          )}
          groupResizeBehavior="preserve-relative-size"
          id="workspace-content"
          minSize="50rem"
        >
          <div className="relative size-full min-h-0 min-w-0">
            <AppLayoutMain />
          </div>
        </ResizablePanel>

        {rightSidebarPresence.isMounted ? (
          <AppLayoutSeparator
            isClosing={rightSidebarPresence.isClosing}
            isCollapsed={!sidebarVisibility.rightSidebarVisible}
            isCompact={isCompact}
          />
        ) : null}

        {rightSidebarPresence.isMounted ? (
          <WorkspaceSidebar
            draggingViewId={dragPreviewViewId}
            dropPlacement={dropPlacement}
            side="right"
            viewHosts={viewHosts}
            views={sidebarLayout.right}
            width={workspaceSidebarWidths.right ?? "20.5rem"}
          />
        ) : null}
      </ResizablePanelGroup>

      {!sidebarVisibility.hasLeftSidebar ? (
        <SidebarEmptyDropTarget
          isActive={dropPlacement?.destination === "left"}
          isDragging={isDraggingView}
          side="left"
        />
      ) : null}
      {!sidebarVisibility.hasRightSidebar ? (
        <SidebarEmptyDropTarget
          isActive={dropPlacement?.destination === "right"}
          isDragging={isDraggingView}
          side="right"
        />
      ) : null}
      <SidebarDropSurface />
    </div>
  );
}

function WorkspaceSidebar({
  draggingViewId,
  dropPlacement,
  side,
  viewHosts,
  views,
  width,
}: {
  draggingViewId: SidebarViewId | null;
  dropPlacement: SidebarDropPlacement | null;
  side: "left" | "right";
  viewHosts: SidebarViewHosts;
  views: SidebarViewId[];
  width: string;
}) {
  const isLeft = side === "left";

  return (
    <ResizablePanel
      className={cn("overflow-hidden!", isLeft ? "ml-1.5" : "mr-1.5")}
      collapsedSize={0}
      collapsible
      defaultSize={width}
      groupResizeBehavior="preserve-pixel-size"
      id={`workspace-${side}-sidebar`}
      maxSize="32rem"
      minSize="20.5rem"
    >
      <AppLayoutPanel
        className={cn(
          "min-w-xs layout-compact:border-y",
          isLeft
            ? "layout-compact:rounded-l-xl layout-compact:border-l"
            : "layout-compact:rounded-r-xl layout-compact:border-r",
        )}
      >
        <AppLayoutSidebar
          draggingViewId={draggingViewId}
          hosts={viewHosts}
          placement={dropPlacement}
          side={side}
          views={views}
        />
      </AppLayoutPanel>
    </ResizablePanel>
  );
}

function SidebarDropSurface() {
  const { ref } = useDroppable({
    accept: "sidebar-view",
    id: "sidebar-drop-surface",
    type: "sidebar-region",
  });

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 bg-transparent"
      ref={ref}
    />
  );
}

function AppLayoutSeparator({
  isClosing,
  isCollapsed,
  isCompact,
}: {
  isClosing?: boolean;
  isCollapsed?: boolean;
  isCompact: boolean;
}) {
  return (
    <ResizableHandle
      className={cn(
        "workspace-separator self-start transition-[width] duration-200 motion-reduce:transition-none",
        isCompact && !isCollapsed ? undefined : "bg-transparent",
      )}
      disabled={isClosing}
      style={
        isClosing ? { width: 0 } : isCompact && !isCollapsed ? undefined : { width: "0.375rem" }
      }
      withHandle={!isClosing && (!isCompact || isCollapsed)}
    />
  );
}

export { AppLayoutWorkspace };
