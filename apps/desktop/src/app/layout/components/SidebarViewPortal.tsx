import { useCallback, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { WorkspaceViewContent } from "@/app/layout/components/WorkspaceViewContent";
import { SIDEBAR_VIEW_IDS } from "@/app/layout/lib/sidebar-layout";
import type { SidebarViewHosts } from "@/app/layout/lib/sidebar-view-hosts";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSidebarLayout } from "@/app/store/slices/preferences-slice";

function SidebarViewPortals({ hosts }: { hosts: SidebarViewHosts }) {
  const sidebarLayout = useAppSelector(selectSidebarLayout);
  const visibleViews = new Set([...sidebarLayout.left, ...sidebarLayout.right]);

  return (
    <>
      {SIDEBAR_VIEW_IDS.filter((viewId) => visibleViews.has(viewId)).map((viewId) =>
        createPortal(<WorkspaceViewContent viewId={viewId} />, hosts[viewId], viewId),
      )}
    </>
  );
}

function SidebarViewTarget({ host }: { host: HTMLDivElement }) {
  const targetRef = useRef<HTMLDivElement>(null);
  const attachTarget = useCallback(
    (target: HTMLDivElement | null) => {
      targetRef.current = target;
      if (target && host.parentElement !== target) target.appendChild(host);
    },
    [host],
  );

  useLayoutEffect(() => {
    const target = targetRef.current;
    if (target && host.parentElement !== target) target.appendChild(host);
  }, [host]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" ref={attachTarget} />
  );
}

export { SidebarViewPortals, SidebarViewTarget };
