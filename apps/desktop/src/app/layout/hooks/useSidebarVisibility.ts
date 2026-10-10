import { usePanelState } from "@/components/ui/resizable";

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

  return {
    hasLeftSidebar,
    hasRightSidebar,
    leftSidebarVisible,
    rightSidebarVisible,
  };
}

export { useSidebarVisibility };
