import { type RefObject, useEffect } from "react";

const CSS_ROOT_FONT_SIZE = 16;
const WORKSPACE_SIDEBAR_MIN_WIDTH = 350;
const WORKSPACE_CONTENT_MIN_WIDTH = 60 * CSS_ROOT_FONT_SIZE;
const WORKSPACE_SEPARATOR_WIDTH = 6;
const WORKSPACE_PANEL_MARGIN = 6;
const WORKSPACE_COLLAPSE_SAFETY_MARGIN = 32;

const WORKSPACE_SIDEBAR_COLLAPSE_THRESHOLD =
  WORKSPACE_SIDEBAR_MIN_WIDTH +
  WORKSPACE_CONTENT_MIN_WIDTH +
  WORKSPACE_SEPARATOR_WIDTH +
  WORKSPACE_PANEL_MARGIN * 2 +
  WORKSPACE_COLLAPSE_SAFETY_MARGIN;

type WorkspaceSidebarPanelRef = {
  collapse: () => void;
  isCollapsed: () => boolean;
};

function shouldCollapseWorkspaceSidebar(workspaceWidth: number) {
  return workspaceWidth < WORKSPACE_SIDEBAR_COLLAPSE_THRESHOLD;
}

function useWorkspaceSidebarResponsiveCollapse(
  workspaceRef: RefObject<HTMLElement | null>,
  sidebarRef: RefObject<WorkspaceSidebarPanelRef | null>,
) {
  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace || typeof ResizeObserver === "undefined") return;

    const collapseIfNeeded = (workspaceWidth: number) => {
      const sidebar = sidebarRef.current;
      if (shouldCollapseWorkspaceSidebar(workspaceWidth) && sidebar && !sidebar.isCollapsed()) {
        sidebar.collapse();
      }
    };

    const observer = new ResizeObserver(([entry]) => {
      if (entry) collapseIfNeeded(entry.contentRect.width);
    });

    observer.observe(workspace);
    collapseIfNeeded(workspace.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, [sidebarRef, workspaceRef]);
}

export {
  shouldCollapseWorkspaceSidebar,
  useWorkspaceSidebarResponsiveCollapse,
  WORKSPACE_SIDEBAR_COLLAPSE_THRESHOLD,
};
