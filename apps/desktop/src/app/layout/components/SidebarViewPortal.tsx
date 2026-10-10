import { useCallback, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { ScrollArea } from "@/components/ui/scroll-area";

import type { SidebarViewHosts } from "@/app/layout/lib/sidebar-view-hosts";
import { ActivityFeed } from "@/features/activity";
import {
  SourceList,
  SourceListCloseAll,
  SourceListContent,
  SourceListSearch,
} from "@/features/source";

function SidebarViewPortals({ hosts }: { hosts: SidebarViewHosts }) {
  return (
    <>
      {createPortal(
        <SourceList>
          <div className="mt-1 flex min-h-0 flex-1 flex-col">
            <div className="flex gap-2">
              <SourceListSearch />
              <SourceListCloseAll />
            </div>
            <SourceListContent className="min-h-0 flex-1" />
          </div>
        </SourceList>,
        hosts.sources,
        "sources",
      )}
      {createPortal(
        <ScrollArea className="flex-1 before:top-2">
          <ActivityFeed className="pb-2" />
        </ScrollArea>,
        hosts.activity,
        "activity",
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
