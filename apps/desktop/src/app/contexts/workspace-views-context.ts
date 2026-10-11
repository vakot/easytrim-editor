import { createContext, useContext } from "react";

import type { SidebarViewId } from "@/app/layout/lib/sidebar-layout";

interface DockPlacementRequest {
  id: number;
  viewId: SidebarViewId;
}

interface WorkspaceViewsContextValue {
  closeDialog: () => void;
  consumeDockPlacementRequest: (requestId: number) => void;
  dialogViewId: SidebarViewId | null;
  dockPlacementRequest: DockPlacementRequest | null;
  openView: (viewId: SidebarViewId) => void;
  requestDockPlacement: (viewId: SidebarViewId) => void;
}

const WorkspaceViewsContext = createContext<WorkspaceViewsContextValue | null>(null);

function useWorkspaceViews() {
  const context = useContext(WorkspaceViewsContext);
  if (!context) throw new Error("Workspace view actions must be used within AppLayout");
  return context;
}

export { useWorkspaceViews, WorkspaceViewsContext };
export type { DockPlacementRequest, WorkspaceViewsContextValue };
