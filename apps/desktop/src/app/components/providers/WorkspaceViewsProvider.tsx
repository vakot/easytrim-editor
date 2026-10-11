import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";

import type { SidebarViewId } from "@/app/layout/lib/sidebar-layout";

import {
  type DockPlacementRequest,
  WorkspaceViewsContext,
} from "@/app/contexts/workspace-views-context";

function WorkspaceViewsProvider({ children }: { children: ReactNode }) {
  const [dialogViewId, setDialogViewId] = useState<SidebarViewId | null>(null);
  const [dockPlacementRequest, setDockPlacementRequest] = useState<DockPlacementRequest | null>(
    null,
  );

  const requestId = useRef(0);

  const openView = useCallback((viewId: SidebarViewId) => setDialogViewId(viewId), []);

  const requestDockPlacement = useCallback((viewId: SidebarViewId) => {
    requestId.current += 1;
    setDockPlacementRequest({ id: requestId.current, viewId });
  }, []);

  const consumeDockPlacementRequest = useCallback((consumedId: number) => {
    setDockPlacementRequest((current) => (current?.id === consumedId ? null : current));
  }, []);

  const closeDialog = useCallback(() => setDialogViewId(null), []);

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
