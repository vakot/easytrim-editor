import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ResizableGroupImperativeHandle } from "@/components/ui/resizable";

import type { SidebarId } from "@/app/layout/lib/sidebar-layout";
import {
  getSavedWorkspaceSidebarWidths,
  saveWorkspaceSidebarWidth,
} from "@/app/layout/lib/workspace-sidebar-widths";

interface WorkspaceSidebarPresence {
  left: boolean;
  right: boolean;
}

interface UseWorkspaceSidebarWidthsOptions extends WorkspaceSidebarPresence {
  workspaceGroupRef: RefObject<ResizableGroupImperativeHandle | null>;
}

function useWorkspaceSidebarWidths({
  left,
  right,
  workspaceGroupRef,
}: UseWorkspaceSidebarWidthsOptions) {
  const [workspaceSidebarWidths, setWorkspaceSidebarWidths] = useState<
    Partial<Record<SidebarId, string>>
  >(getSavedWorkspaceSidebarWidths);

  const workspaceSidebarWidthsRef = useRef(workspaceSidebarWidths);
  const previousSidebarPresence = useRef({ left, right });

  useEffect(() => {
    const wasPresent = previousSidebarPresence.current;
    previousSidebarPresence.current = { left, right };

    const addedSidebars = (["left", "right"] as const).filter(
      (side) => !wasPresent[side] && (side === "left" ? left : right),
    );

    if (addedSidebars.length === 0) return;

    const frame = window.requestAnimationFrame(() => {
      const workspace = document.getElementById("workspace");
      if (!workspace) return;

      const separatorWidth = Array.from(
        workspace.querySelectorAll<HTMLElement>(":scope > [data-separator]"),
      ).reduce((total, separator) => total + separator.getBoundingClientRect().width, 0);

      const availableWidth = workspace.getBoundingClientRect().width - separatorWidth;
      if (availableWidth <= 0) return;

      const layout: Record<string, number> = {};
      let sidebarsWidth = 0;
      for (const side of ["left", "right"] as const) {
        const isPresent = side === "left" ? left : right;
        const panelId = `workspace-${side}-sidebar`;
        const width = isPresent
          ? Number.parseFloat(workspaceSidebarWidthsRef.current[side] ?? "")
          : 0;

        if (isPresent && (!Number.isFinite(width) || width <= 0)) continue;

        layout[panelId] = (width / availableWidth) * 100;
        sidebarsWidth += width;
      }

      layout["workspace-content"] = Math.max(
        0,
        ((availableWidth - sidebarsWidth) / availableWidth) * 100,
      );
      workspaceGroupRef.current?.setLayout(layout);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [left, right, workspaceGroupRef]);

  const handleWorkspaceLayoutChanged = useCallback(
    (layout: Record<string, number>, meta: { isUserInteraction: boolean }) => {
      const workspace = document.getElementById("workspace");
      if (!workspace) return;

      const separatorWidth = Array.from(
        workspace.querySelectorAll<HTMLElement>(":scope > [data-separator]"),
      ).reduce((total, separator) => total + separator.getBoundingClientRect().width, 0);

      const availableWidth = workspace.getBoundingClientRect().width - separatorWidth;
      if (availableWidth <= 0) return;

      const nextWidths = { ...workspaceSidebarWidthsRef.current };
      let hasChanged = false;
      for (const side of ["left", "right"] as const) {
        const panelId = side === "left" ? "workspace-left-sidebar" : "workspace-right-sidebar";
        const panelSize = layout[panelId];
        if (panelSize === undefined || panelSize <= 0) continue;
        if (!meta.isUserInteraction && nextWidths[side]) continue;

        const measuredWidth = document.getElementById(panelId)?.getBoundingClientRect().width;
        const sidebarWidth = measuredWidth || (availableWidth * panelSize) / 100;
        const width = `${sidebarWidth}px`;
        const currentWidth = Number.parseFloat(nextWidths[side] ?? "");
        if (
          meta.isUserInteraction &&
          (!Number.isFinite(currentWidth) || Math.abs(currentWidth - sidebarWidth) > 0.5)
        ) {
          saveWorkspaceSidebarWidth(side, sidebarWidth);
        }

        if (nextWidths[side] !== width) {
          nextWidths[side] = width;
          hasChanged = true;
        }
      }

      if (hasChanged) {
        workspaceSidebarWidthsRef.current = nextWidths;
        setWorkspaceSidebarWidths(nextWidths);
      }
    },
    [],
  );

  useEffect(() => {
    workspaceSidebarWidthsRef.current = workspaceSidebarWidths;
  }, [workspaceSidebarWidths]);

  return { handleWorkspaceLayoutChanged, workspaceSidebarWidths };
}

export { useWorkspaceSidebarWidths };
