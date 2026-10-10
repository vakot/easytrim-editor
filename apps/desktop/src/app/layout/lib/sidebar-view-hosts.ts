import type { SidebarViewId } from "@/app/layout/lib/sidebar-layout";

type SidebarViewHosts = Record<SidebarViewId, HTMLDivElement>;

function createSidebarViewHosts(): SidebarViewHosts {
  const createHost = () => {
    const host = document.createElement("div");
    host.className = "flex size-full min-h-0 min-w-0 flex-col";
    return host;
  };

  return { activity: createHost(), sources: createHost() };
}

export { createSidebarViewHosts };
export type { SidebarViewHosts };
