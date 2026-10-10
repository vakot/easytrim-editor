import { useCallback, useEffect, useRef, useState } from "react";

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

  const resizeSidebar = useCallback(
    (side: SidebarId, width: number) => {
      const panel = side === "left" ? leftSidebar : rightSidebar;
      panel?.ref.current?.resize(width);
    },
    [leftSidebar, rightSidebar],
  );

  return {
    hasLeftSidebar,
    hasRightSidebar,
    leftSidebarVisible,
    rightSidebarVisible,
    isSidebarCollapsed,
    resizeSidebar,
    setSidebarExpanded,
  };
}

function useSidebarPresence(side: SidebarId, hasSidebar: boolean) {
  const panel = usePanelState(`workspace-${side}-sidebar`);
  const [isMounted, setIsMounted] = useState(hasSidebar);
  const previousHasSidebar = useRef(hasSidebar);
  const hasSidebarRef = useRef(hasSidebar);
  const shouldExpandWhenRegistered = useRef(false);
  const closeTimer = useRef<number | null>(null);
  useEffect(() => {
    hasSidebarRef.current = hasSidebar;
    const wasPresent = previousHasSidebar.current;
    previousHasSidebar.current = hasSidebar;

    if (hasSidebar) {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }

      if (!wasPresent) {
        shouldExpandWhenRegistered.current = true;
        setIsMounted(true);
      }

      const panelHandle = panel?.ref.current;
      if (shouldExpandWhenRegistered.current && panelHandle) {
        if (panelHandle.isCollapsed()) panelHandle.expand();
        shouldExpandWhenRegistered.current = false;
      }
      return;
    }

    if (!isMounted || closeTimer.current !== null) return;

    const panelHandle = panel?.ref.current;
    const wasCollapsed = panelHandle?.isCollapsed() ?? true;
    panelHandle?.collapse();

    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    closeTimer.current = window.setTimeout(
      () => {
        closeTimer.current = null;
        if (!hasSidebarRef.current) setIsMounted(false);
      },
      wasCollapsed || prefersReducedMotion ? 0 : 200,
    );
  }, [hasSidebar, isMounted, panel]);

  useEffect(
    () => () => {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    },
    [],
  );

  return { isClosing: isMounted && !hasSidebar, isMounted };
}

export { useSidebarPresence, useSidebarVisibility };
