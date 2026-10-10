import {
  DragDropProvider,
  type DragEndEvent,
  type DragMoveEvent,
  useDroppable,
} from "@dnd-kit/react";
import { useCallback, useLayoutEffect, useState } from "react";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

import { AppLayoutFooter } from "@/app/layout/components/AppLayoutFooter";
import { AppLayoutHeader } from "@/app/layout/components/AppLayoutHeader";
import { AppLayoutMain } from "@/app/layout/components/AppLayoutMain";
import { AppLayoutPanel } from "@/app/layout/components/AppLayoutPanel";
import { AppLayoutSidebar, SidebarEmptyDropTarget } from "@/app/layout/components/AppLayoutSidebar";
import { SidebarViewPortals } from "@/app/layout/components/SidebarViewPortal";
import {
  isSidebarId,
  isSidebarViewId,
  resolveSidebarDropPlacement,
  type SidebarDropPlacement,
  type SidebarViewBounds,
} from "@/app/layout/lib/sidebar-layout";
import { createSidebarViewHosts } from "@/app/layout/lib/sidebar-view-hosts";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectLayoutDensity,
  selectSidebarLayout,
  selectUiScalePercent,
  sidebarLayoutChanged,
} from "@/app/store/slices/preferences-slice";
import { cn } from "@/lib/class-names.utils";

import { useSidebarVisibility } from "./hooks/useSidebarVisibility";

function AppLayout() {
  const dispatch = useAppDispatch();
  const layoutDensity = useAppSelector(selectLayoutDensity);
  const sidebarLayout = useAppSelector(selectSidebarLayout);
  const uiScalePercent = useAppSelector(selectUiScalePercent);
  const { hasLeftSidebar, hasRightSidebar, leftSidebarVisible, rightSidebarVisible } =
    useSidebarVisibility();

  const [viewHosts] = useState(createSidebarViewHosts);
  const [isDraggingView, setIsDraggingView] = useState(false);
  const [dropPlacement, setDropPlacement] = useState<SidebarDropPlacement | null>(null);

  const isCompact = layoutDensity === "compact";

  const getDropPlacement = useCallback(
    (event: DragMoveEvent | DragEndEvent) => {
      const viewId = event.operation.source?.id;
      if (!isSidebarViewId(viewId)) {
        return null;
      }

      const position = event.operation.position.current;
      if (!position) return null;

      const containsPointer = (element: HTMLElement) => {
        const bounds = element.getBoundingClientRect();
        return (
          position.x >= bounds.left &&
          position.x <= bounds.right &&
          position.y >= bounds.top &&
          position.y <= bounds.bottom
        );
      };

      const emptyTarget = Array.from(
        document.querySelectorAll<HTMLElement>("[data-sidebar-empty-drop-target]"),
      ).find(containsPointer);

      const populatedRegion = Array.from(
        document.querySelectorAll<HTMLElement>("[data-sidebar-region]"),
      ).find(containsPointer);

      const destination = isSidebarId(emptyTarget?.dataset.sidebarEmptyDropTarget)
        ? emptyTarget.dataset.sidebarEmptyDropTarget
        : populatedRegion?.dataset.sidebarRegion;

      if (!isSidebarId(destination)) return null;

      const regionElement = isSidebarId(emptyTarget?.dataset.sidebarEmptyDropTarget)
        ? emptyTarget
        : populatedRegion;

      if (!regionElement) return null;

      const destinationBounds: SidebarViewBounds[] = sidebarLayout[destination]
        .filter((item) => item !== viewId)
        .flatMap((item) => {
          const element = document.querySelector<HTMLElement>(`[data-sidebar-view="${item}"]`);
          if (!element) return [];
          const bounds = element.getBoundingClientRect();
          return [{ bottom: bounds.bottom, top: bounds.top, viewId: item }];
        });

      return resolveSidebarDropPlacement(
        sidebarLayout,
        viewId,
        destination,
        position.y,
        regionElement.getBoundingClientRect().top,
        destinationBounds,
      );
    },
    [sidebarLayout],
  );

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => setDropPlacement(getDropPlacement(event)),
    [getDropPlacement],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const placement = event.canceled ? null : getDropPlacement(event);
      setDropPlacement(null);
      setIsDraggingView(false);
      if (placement) {
        dispatch(
          sidebarLayoutChanged({
            destination: placement.destination,
            insertionIndex: placement.insertionIndex,
            viewId: placement.viewId,
          }),
        );
      }
    },
    [dispatch, getDropPlacement],
  );

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousFontSize = root.style.fontSize;
    root.style.fontSize = `${uiScalePercent}%`;
    return () => {
      root.style.fontSize = previousFontSize;
    };
  }, [uiScalePercent]);

  return (
    <DragDropProvider
      onDragEnd={handleDragEnd}
      onDragMove={handleDragMove}
      onDragStart={() => setIsDraggingView(true)}
    >
      <main className="fixed inset-0 grid h-dvh w-screen grid-rows-[2.25rem_minmax(0,1fr)_auto] overflow-hidden bg-background">
        <AppLayoutHeader />

        <div className="relative min-h-0 min-w-0">
          <ResizablePanelGroup
            className="*:data-panel:transition-[flex-grow,flex-basis] *:data-panel:duration-200 *:data-panel:ease-out has-data-[separator=active]:*:data-panel:transition-none motion-reduce:*:data-panel:transition-none"
            id="workspace"
            key={`${hasLeftSidebar}:${hasRightSidebar}`}
            persisted
          >
            {hasLeftSidebar ? (
              <ResizablePanel
                className="ml-1.5 overflow-hidden!"
                collapsedSize={0}
                collapsible
                defaultSize="20.5rem"
                groupResizeBehavior="preserve-pixel-size"
                id="workspace-left-sidebar"
                maxSize="30rem"
                minSize="20.5rem"
              >
                <AppLayoutPanel className="min-w-xs layout-compact:rounded-l-xl layout-compact:border-y layout-compact:border-l">
                  <AppLayoutSidebar
                    hosts={viewHosts}
                    placement={dropPlacement}
                    side="left"
                    views={sidebarLayout.left}
                  />
                </AppLayoutPanel>
              </ResizablePanel>
            ) : null}

            {hasLeftSidebar ? (
              <AppLayoutSeparator isCollapsed={!leftSidebarVisible} isCompact={isCompact} />
            ) : null}

            <ResizablePanel
              className={cn(
                "overflow-hidden!",
                !hasLeftSidebar && "ml-1.5",
                !hasRightSidebar && "mr-1.5",
              )}
              groupResizeBehavior="preserve-relative-size"
              id="workspace-content"
              minSize="50rem"
            >
              <div className="relative size-full min-h-0 min-w-0">
                <AppLayoutMain />

                {!hasLeftSidebar ? (
                  <SidebarEmptyDropTarget isDragging={isDraggingView} side="left" />
                ) : null}
                {!hasRightSidebar ? (
                  <SidebarEmptyDropTarget isDragging={isDraggingView} side="right" />
                ) : null}
              </div>
            </ResizablePanel>

            {hasRightSidebar ? (
              <AppLayoutSeparator isCollapsed={!rightSidebarVisible} isCompact={isCompact} />
            ) : null}

            {hasRightSidebar ? (
              <ResizablePanel
                className="mr-1.5 overflow-hidden!"
                collapsedSize={0}
                collapsible
                defaultSize="20.5rem"
                groupResizeBehavior="preserve-pixel-size"
                id="workspace-right-sidebar"
                maxSize="30rem"
                minSize="20.5rem"
              >
                <AppLayoutPanel className="min-w-xs layout-compact:rounded-r-xl layout-compact:border-y layout-compact:border-r">
                  <AppLayoutSidebar
                    hosts={viewHosts}
                    placement={dropPlacement}
                    side="right"
                    views={sidebarLayout.right}
                  />
                </AppLayoutPanel>
              </ResizablePanel>
            ) : null}
          </ResizablePanelGroup>
        </div>

        <SidebarViewPortals hosts={viewHosts} />
        <SidebarDropSurface />
        <AppLayoutFooter />
      </main>
    </DragDropProvider>
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
  isCollapsed,
  isCompact,
}: {
  isCollapsed?: boolean;
  isCompact: boolean;
}) {
  return (
    <ResizableHandle
      className={cn(
        "workspace-separator self-start",
        isCompact && !isCollapsed ? undefined : "bg-transparent",
      )}
      style={isCompact && !isCollapsed ? undefined : { width: "0.375rem" }}
      withHandle={!isCompact || isCollapsed}
    />
  );
}

export { AppLayout };
