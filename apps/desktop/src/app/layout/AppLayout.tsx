import { DragDropProvider } from "@dnd-kit/react";
import { lazy, Suspense, useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useWorkspaceViews } from "@/app/contexts/workspace-views-context";
import { AppLayoutFooter } from "@/app/layout/components/AppLayoutFooter";
import { AppLayoutHeader } from "@/app/layout/components/AppLayoutHeader";
import { SidebarDragPreview } from "@/app/layout/components/AppLayoutSidebar";
import { AppLayoutWorkspace } from "@/app/layout/components/AppLayoutWorkspace";
import { SidebarViewPortals } from "@/app/layout/components/SidebarViewPortal";
import { useSidebarDragAndDrop } from "@/app/layout/hooks/useSidebarDragAndDrop";
import type { SidebarViewId } from "@/app/layout/lib/sidebar-layout";
import { createSidebarViewHosts } from "@/app/layout/lib/sidebar-view-hosts";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectUiScalePercent } from "@/app/store/slices/preferences-slice";

const ActivityWorkspaceDialog = lazy(() =>
  import("@/app/layout/components/workspace-dialogs/ActivityWorkspaceDialog").then((module) => ({
    default: module.ActivityWorkspaceDialog,
  })),
);

const ExportQueueDialog = lazy(() =>
  import("@/app/layout/components/workspace-dialogs/ExportQueueDialog").then((module) => ({
    default: module.ExportQueueDialog,
  })),
);

const SourcesWorkspaceDialog = lazy(() =>
  import("@/app/layout/components/workspace-dialogs/SourcesWorkspaceDialog").then((module) => ({
    default: module.SourcesWorkspaceDialog,
  })),
);

const WORKSPACE_DIALOGS: Record<SidebarViewId, typeof ActivityWorkspaceDialog> = {
  activity: ActivityWorkspaceDialog,
  exportQueue: ExportQueueDialog,
  sources: SourcesWorkspaceDialog,
};

function AppLayout() {
  const uiScalePercent = useAppSelector(selectUiScalePercent);
  const [viewHosts] = useState(createSidebarViewHosts);
  const drag = useSidebarDragAndDrop();
  const beginDockPlacement = drag.beginDockPlacement;
  const { closeDialog, consumeDockPlacementRequest, dialogViewId, dockPlacementRequest } =
    useWorkspaceViews();

  const WorkspaceDialog = dialogViewId ? WORKSPACE_DIALOGS[dialogViewId] : null;

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) closeDialog();
  };

  useEffect(() => {
    if (!dockPlacementRequest) return;
    beginDockPlacement(dockPlacementRequest.viewId);
    consumeDockPlacementRequest(dockPlacementRequest.id);
  }, [beginDockPlacement, consumeDockPlacementRequest, dockPlacementRequest]);

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
      onDragEnd={drag.handleDragEnd}
      onDragMove={drag.handleDragMove}
      onDragStart={drag.handleDragStart}
    >
      <main
        className="fixed inset-0 grid h-dvh w-screen grid-rows-[2.25rem_minmax(0,1fr)_auto] overflow-hidden bg-background"
        onKeyDown={drag.handleKeyboardDragKeyDown}
      >
        <div aria-atomic="true" aria-live="polite" className="sr-only" role="status">
          {drag.keyboardDragAnnouncement}
        </div>
        {drag.isDockPlacementMode ? <DockPlacementFeedback /> : null}
        <AppLayoutHeader />

        <AppLayoutWorkspace
          dragPreviewViewId={drag.dragPreview?.viewId ?? null}
          dropPlacement={drag.dropPlacement}
          isDraggingView={drag.isDraggingView}
          sidebarLayout={drag.sidebarLayout}
          sidebarVisibility={drag.sidebarVisibility}
          viewHosts={viewHosts}
        />

        <SidebarViewPortals hosts={viewHosts} />
        <AppLayoutFooter />
        {drag.dragPreview ? (
          <SidebarDragPreview
            position={drag.dragPreview.position}
            viewId={drag.dragPreview.viewId}
          />
        ) : null}
        <Suspense fallback={null}>
          {WorkspaceDialog ? (
            <WorkspaceDialog onOpenChange={handleDialogOpenChange} open />
          ) : null}
        </Suspense>
      </main>
    </DragDropProvider>
  );
}

function DockPlacementFeedback() {
  const { t } = useTranslation();

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-60 bg-background/10" />
      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-90 mx-auto w-fit rounded-md border bg-background/95 px-3 py-2 text-sm shadow-lg"
        role="status"
      >
        {t("layout.dockPlacement.instructions")}
      </div>
    </>
  );
}

export { AppLayout };
