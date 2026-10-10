import { useCallback } from "react";

import { usePanelState } from "@/components/ui/resizable";

import type { SidebarId } from "@/app/layout/lib/sidebar-layout";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSidebarLayout } from "@/app/store/slices/preferences-slice";

function useSidebarVisibility() {
  const sidebarLayout = useAppSelector(selectSidebarLayout);

  const leftSidebar = usePanelState("workspace-left-sidebar");
  const rightSidebar = usePanelState("workspace-right-sidebar");

  const hasLeftSidebar = sidebarLayout.left.length > 0;
  const hasRightSidebar = sidebarLayout.right.length > 0;

  const leftSidebarVisible = hasLeftSidebar && !leftSidebar?.isCollapsed;
  const rightSidebarVisible = hasRightSidebar && !rightSidebar?.isCollapsed;
  const isSidebarCollapsed = useCallback(
    (side: SidebarId) => {
      const panel = side === "left" ? leftSidebar : rightSidebar;
      return panel?.ref.current?.isCollapsed() ?? panel?.isCollapsed ?? true;
    },
    [leftSidebar, rightSidebar],
  );

  const setSidebarExpanded = useCallback(
    (side: SidebarId, isExpanded: boolean) => {
      const panel = side === "left" ? leftSidebar : rightSidebar;
      const panelHandle = panel?.ref.current;
      if (!panelHandle || panelHandle.isCollapsed() === !isExpanded) return;

      if (isExpanded) panelHandle.expand();
      else panelHandle.collapse();
    },
    [leftSidebar, rightSidebar],
  );

  return {
    hasLeftSidebar,
    hasRightSidebar,
    leftSidebarVisible,
    rightSidebarVisible,
    isSidebarCollapsed,
    setSidebarExpanded,
  };
}

export { useSidebarVisibility };
