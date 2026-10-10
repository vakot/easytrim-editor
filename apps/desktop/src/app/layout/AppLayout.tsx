import { useCallback, useLayoutEffect, useState } from "react";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

import { AppLayoutFooter } from "@/app/layout/components/AppLayoutFooter";
import { AppLayoutHeader } from "@/app/layout/components/AppLayoutHeader";
import { AppLayoutMain } from "@/app/layout/components/AppLayoutMain";
import { AppLayoutPanel } from "@/app/layout/components/AppLayoutPanel";
import {
  AppLayoutSidebar,
  type SidebarDropPreview,
  SidebarEmptyDropTarget,
} from "@/app/layout/components/AppLayoutSidebar";
import { SidebarViewPortals } from "@/app/layout/components/SidebarViewPortal";
import type { SidebarId, SidebarViewId } from "@/app/layout/lib/sidebar-layout";
import { createSidebarViewHosts } from "@/app/layout/lib/sidebar-view-hosts";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectLayoutDensity,
  selectSidebarLayout,
  selectUiScalePercent,
  sidebarLayoutChanged,
} from "@/app/store/slices/preferences-slice";

function AppLayout() {
  const dispatch = useAppDispatch();
  const layoutDensity = useAppSelector(selectLayoutDensity);
  const sidebarLayout = useAppSelector(selectSidebarLayout);
  const uiScalePercent = useAppSelector(selectUiScalePercent);
  const isCompact = layoutDensity === "compact";
  const [viewHosts] = useState(createSidebarViewHosts);
  const [draggedViewId, setDraggedViewId] = useState<SidebarViewId | null>(null);
  const [dropPreview, setDropPreview] = useState<SidebarDropPreview | null>(null);

  const handleDragStart = useCallback((viewId: SidebarViewId, dataTransfer: DataTransfer) => {
    setDraggedViewId(viewId);
    setDropPreview(null);
    dataTransfer.effectAllowed = "move";
    dataTransfer.setData("text/plain", viewId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedViewId(null);
    setDropPreview(null);
  }, []);

  const handleDrop = useCallback(
    (viewId: SidebarViewId, destination: SidebarId, insertionIndex: number) => {
      dispatch(sidebarLayoutChanged({ destination, insertionIndex, viewId }));
      handleDragEnd();
    },
    [dispatch, handleDragEnd],
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
    <main className="fixed inset-0 grid h-dvh w-screen min-w-80 grid-rows-[2.25rem_minmax(0,1fr)_auto] overflow-hidden bg-background">
      <AppLayoutHeader />

      <div className="relative min-h-0 min-w-0">
        <ResizablePanelGroup
          className="*:data-panel:transition-[flex-grow,flex-basis] *:data-panel:duration-200 *:data-panel:ease-out has-data-[separator=active]:*:data-panel:transition-none motion-reduce:*:data-panel:transition-none"
          id="workspace"
          key={`${sidebarLayout.left.length > 0}:${sidebarLayout.right.length > 0}`}
          persisted
        >
          {sidebarLayout.left.length > 0 ? (
            <>
              <ResizablePanel
                className="ml-1.5 overflow-hidden!"
                collapsedSize={0}
                collapsible
                defaultSize="25rem"
                groupResizeBehavior="preserve-pixel-size"
                id="workspace-left-sidebar"
                maxSize="30rem"
                minSize="15rem"
              >
                <AppLayoutPanel className="min-w-0 layout-compact:rounded-l-xl layout-compact:border-r-0">
                  <AppLayoutSidebar
                    draggedViewId={draggedViewId}
                    dropPreview={dropPreview}
                    hosts={viewHosts}
                    onDragEnd={handleDragEnd}
                    onDragStart={handleDragStart}
                    onDrop={handleDrop}
                    onPreview={setDropPreview}
                    side="left"
                    views={sidebarLayout.left}
                  />
                </AppLayoutPanel>
              </ResizablePanel>
              <WorkspaceSeparator isCompact={isCompact} />
            </>
          ) : null}

          <ResizablePanel
            className="overflow-hidden!"
            groupResizeBehavior="preserve-relative-size"
            id="workspace-content"
            minSize="50rem"
          >
            <div className="relative size-full min-h-0 min-w-0">
              <AppLayoutMain />
              {draggedViewId && sidebarLayout.left.length === 0 ? (
                <SidebarEmptyDropTarget
                  draggedViewId={draggedViewId}
                  onDrop={handleDrop}
                  onPreview={setDropPreview}
                  preview={dropPreview}
                  side="left"
                />
              ) : null}
              {draggedViewId && sidebarLayout.right.length === 0 ? (
                <SidebarEmptyDropTarget
                  draggedViewId={draggedViewId}
                  onDrop={handleDrop}
                  onPreview={setDropPreview}
                  preview={dropPreview}
                  side="right"
                />
              ) : null}
            </div>
          </ResizablePanel>

          {sidebarLayout.right.length > 0 ? (
            <>
              <WorkspaceSeparator isCompact={isCompact} />
              <ResizablePanel
                className="mr-1.5 overflow-hidden!"
                collapsedSize={0}
                collapsible
                defaultSize="22rem"
                groupResizeBehavior="preserve-pixel-size"
                id="workspace-right-sidebar"
                maxSize="30rem"
                minSize="15rem"
              >
                <AppLayoutPanel className="min-w-0 layout-compact:rounded-r-xl layout-compact:border-l-0">
                  <AppLayoutSidebar
                    draggedViewId={draggedViewId}
                    dropPreview={dropPreview}
                    hosts={viewHosts}
                    onDragEnd={handleDragEnd}
                    onDragStart={handleDragStart}
                    onDrop={handleDrop}
                    onPreview={setDropPreview}
                    side="right"
                    views={sidebarLayout.right}
                  />
                </AppLayoutPanel>
              </ResizablePanel>
            </>
          ) : null}
        </ResizablePanelGroup>
      </div>

      <SidebarViewPortals hosts={viewHosts} />
      <AppLayoutFooter />
    </main>
  );
}

function WorkspaceSeparator({ isCompact }: { isCompact: boolean }) {
  return (
    <ResizableHandle
      className="workspace-separator self-start layout-default:bg-transparent"
      style={isCompact ? undefined : { width: "0.375rem" }}
      withHandle
    />
  );
}

export { AppLayout };
