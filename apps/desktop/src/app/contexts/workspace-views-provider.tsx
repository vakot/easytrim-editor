import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";

import type { SidebarViewId } from "@/app/layout/lib/sidebar-layout";
import { useAppDispatch } from "@/app/store/redux-hooks";
import { exportQueueDialogOpened } from "@/app/store/slices/export-slice";

import { type DockPlacementRequest, WorkspaceViewsContext } from "./workspace-views-context";

function WorkspaceViewsProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const [dialogViewId, setDialogViewId] = useState<SidebarViewId | null>(null);
  const [dockPlacementRequest, setDockPlacementRequest] = useState<DockPlacementRequest | null>(
    null,
  );

  const requestId = useRef(0);

  const openView = useCallback(
    (viewId: SidebarViewId) => {
      if (viewId === "exportQueue") {
        dispatch(exportQueueDialogOpened());
        return;
      }
      setDialogViewId(viewId);
    },
    [dispatch],
  );

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
