import { useEffect, useRef, useState } from "react";

import { usePanelState } from "@/components/ui/resizable";

import type { SidebarId } from "@/app/layout/lib/sidebar-layout";

function useSidebarPresence(side: SidebarId, hasSidebar: boolean) {
  const panel = usePanelState(`workspace-${side}-sidebar`);
  const [isMounted, setIsMounted] = useState(hasSidebar);
  const previousHasSidebar = useRef(hasSidebar);
  const presenceVersion = useRef(0);
  const shouldExpandWhenRegistered = useRef(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    const wasPresent = previousHasSidebar.current;
    if (wasPresent !== hasSidebar) presenceVersion.current += 1;
    const transitionVersion = presenceVersion.current;
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

    if (!isMounted && wasPresent) {
      setIsMounted(true);
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
        if (presenceVersion.current === transitionVersion) {
          setIsMounted(false);
        }
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

export { useSidebarPresence };
