import type { SidebarId, SidebarLayout, SidebarViewId } from "./sidebar-layout";

interface WorkspaceViewDescriptor {
  id: SidebarViewId;
}

const WORKSPACE_VIEWS: WorkspaceViewDescriptor[] = [
  { id: "sources" },
  { id: "activity" },
  { id: "history" },
  { id: "exportQueue" },
];

function getSidebarViewSide(layout: SidebarLayout, viewId: SidebarViewId): SidebarId | null {
  if (layout.left.includes(viewId)) return "left";
  if (layout.right.includes(viewId)) return "right";
  return null;
}

export { getSidebarViewSide, WORKSPACE_VIEWS };
export type { WorkspaceViewDescriptor };
