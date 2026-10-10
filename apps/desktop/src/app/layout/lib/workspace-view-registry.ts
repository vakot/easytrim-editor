import {
  SIDEBAR_VIEW_IDS,
  type SidebarId,
  type SidebarLayout,
  type SidebarViewId,
} from "./sidebar-layout";

interface WorkspaceViewDescriptor {
  id: SidebarViewId;
}

const WORKSPACE_VIEWS: WorkspaceViewDescriptor[] = [
  { id: "sources" },
  { id: "activity" },
  { id: "exportQueue" },
];

interface DockViewGroup {
  id: SidebarId | "available";
  views: SidebarViewId[];
}

function getDockViewGroups(layout: SidebarLayout): DockViewGroup[] {
  const groups: DockViewGroup[] = [
    { id: "left", views: layout.left },
    { id: "right", views: layout.right },
    {
      id: "available",
      views: SIDEBAR_VIEW_IDS.filter(
        (viewId) => !layout.left.includes(viewId) && !layout.right.includes(viewId),
      ),
    },
  ];

  return groups.filter((group) => group.views.length > 0);
}

function getSidebarViewSide(layout: SidebarLayout, viewId: SidebarViewId): SidebarId | null {
  if (layout.left.includes(viewId)) return "left";
  if (layout.right.includes(viewId)) return "right";
  return null;
}

export { getDockViewGroups, getSidebarViewSide, WORKSPACE_VIEWS };
export type { DockViewGroup, WorkspaceViewDescriptor };
