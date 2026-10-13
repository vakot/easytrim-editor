import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";

import {
  type DockPlacementRequest,
  WorkspaceViewsContext,
} from "@/app/contexts/workspace-views-context";
import type { SidebarViewId } from "@/app/layout/lib/sidebar-layout";
import { preloadWorkspaceDialog } from "@/app/layout/lib/workspace-view-loaders";

function WorkspaceViewsProvider({ children }: { children: ReactNode }) {
  const [dialogViewId, setDialogViewId] = useState<SidebarViewId | null>(null);
  const [dockPlacementRequest, setDockPlacementRequest] = useState<DockPlacementRequest | null>(
    null,
  );

  const requestId = useRef(0);
  const dialogOpenRequestId = useRef(0);

  const openView = useCallback((viewId: SidebarViewId) => {
    dialogOpenRequestId.current += 1;
    const currentRequestId = dialogOpenRequestId.current;

    void preloadWorkspaceDialog(viewId)
      .catch(() => undefined)
      .then(() => {
        if (currentRequestId === dialogOpenRequestId.current) setDialogViewId(viewId);
      });
  }, []);

  const requestDockPlacement = useCallback((viewId: SidebarViewId) => {
    requestId.current += 1;
    setDockPlacementRequest({ id: requestId.current, viewId });
  }, []);

  const consumeDockPlacementRequest = useCallback((consumedId: number) => {
    setDockPlacementRequest((current) => (current?.id === consumedId ? null : current));
  }, []);

  const closeDialog = useCallback(() => {
    dialogOpenRequestId.current += 1;
    setDialogViewId(null);
  }, []);

  const value = useMemo(
    () => ({
      closeDialog,
      consumeDockPlacementRequest,
      dialogViewId,
      dockPlacementRequest,
      openView,
      requestDockPlacement,
    }),
    [
      closeDialog,
      consumeDockPlacementRequest,
      dialogViewId,
      dockPlacementRequest,
      openView,
      requestDockPlacement,
    ],
  );

  return <WorkspaceViewsContext.Provider value={value}>{children}</WorkspaceViewsContext.Provider>;
}

export { WorkspaceViewsProvider };
