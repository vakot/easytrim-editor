import { DragDropProvider } from "@dnd-kit/react";
import { useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useWorkspaceViews } from "@/app/contexts/workspace-views-context";
import { AppLayoutFooter } from "@/app/layout/components/AppLayoutFooter";
import { AppLayoutHeader } from "@/app/layout/components/AppLayoutHeader";
import { SidebarDragPreview } from "@/app/layout/components/AppLayoutSidebar";
import { AppLayoutWorkspace } from "@/app/layout/components/AppLayoutWorkspace";
import { SidebarViewPortals } from "@/app/layout/components/SidebarViewPortal";
import { WorkspaceViewContent } from "@/app/layout/components/WorkspaceViewContent";
import { useSidebarDragAndDrop } from "@/app/layout/hooks/useSidebarDragAndDrop";
import type { SidebarViewId } from "@/app/layout/lib/sidebar-layout";
import { createSidebarViewHosts } from "@/app/layout/lib/sidebar-view-hosts";
import { WORKSPACE_VIEWS } from "@/app/layout/lib/workspace-view-registry";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectUiScalePercent } from "@/app/store/slices/preferences-slice";

function AppLayout() {
  const uiScalePercent = useAppSelector(selectUiScalePercent);
  const [viewHosts] = useState(createSidebarViewHosts);
  const drag = useSidebarDragAndDrop();
  const beginDockPlacement = drag.beginDockPlacement;
  const { closeDialog, consumeDockPlacementRequest, dialogViewId, dockPlacementRequest } =
    useWorkspaceViews();

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
        <WorkspaceViewDialog
          onOpenChange={(open) => {
            if (!open) closeDialog();
          }}
          viewId={dialogViewId}
        />
      </main>
    </DragDropProvider>
  );
}

function WorkspaceViewDialog({
  onOpenChange,
  viewId,
}: {
  onOpenChange: (open: boolean) => void;
  viewId: SidebarViewId | null;
}) {
  const { t } = useTranslation();
  const view = WORKSPACE_VIEWS.find((item) => item.id === viewId);
  const title =
    view?.id === "activity"
      ? t("layout.activityFeed")
      : view?.id === "exportQueue"
        ? t("queue.title")
        : view?.id === "sources"
          ? t("source.importedSources")
          : null;

  return (
    <Dialog onOpenChange={onOpenChange} open={viewId !== null}>
      {viewId && view && title ? (
        <DialogContent className="grid max-h-[min(80dvh,48rem)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">
              {t("layout.workspaceViewDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
            <WorkspaceViewContent viewId={viewId} />
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
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
