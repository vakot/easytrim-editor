import { useRef } from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  usePanelRef,
} from "@/components/ui/resizable";

import { AppLayoutFooter } from "@/app/layout/components/AppLayoutFooter";
import { AppLayoutHeader } from "@/app/layout/components/AppLayoutHeader";
import { AppLayoutPanel } from "@/app/layout/components/AppLayoutPanel";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectLayoutDensity } from "@/app/store/slices/preferences-slice";

import { AppLayoutMain } from "./components/AppLayoutMain";
import { AppLayoutSidebar } from "./components/AppLayoutSidebar";
import { useWorkspaceSidebarResponsiveCollapse } from "./workspace-layout";

function AppLayout() {
  const layoutDensity = useAppSelector(selectLayoutDensity);
  const isCompact = layoutDensity === "compact";
  const workspaceRef = useRef<HTMLDivElement>(null);
  const sidebarRef = usePanelRef();
  useWorkspaceSidebarResponsiveCollapse(workspaceRef, sidebarRef);

  return (
    <main className="fixed inset-0 grid h-dvh w-screen min-w-80 grid-rows-[2.25rem_minmax(0,1fr)_auto] overflow-hidden bg-background">
      <AppLayoutHeader />

      <div className="size-full min-h-0 min-w-0" ref={workspaceRef}>
        <ResizablePanelGroup id="workspace" persisted>
          <ResizablePanel
            className="ml-1.5 overflow-hidden!"
            collapsedSize={0}
            collapsible
            defaultSize="400px"
            groupResizeBehavior="preserve-pixel-size"
            id="workspace-sidebar"
            maxSize="500px"
            minSize="350px"
            panelRef={sidebarRef}
          >
            <AppLayoutPanel className="layout-compact:rounded-l-xl layout-compact:border-r-0">
              <AppLayoutSidebar />
            </AppLayoutPanel>
          </ResizablePanel>

          <ResizableHandle
            className="workspace-separator self-start layout-default:bg-transparent"
            style={isCompact ? undefined : { width: 6 }}
            withHandle
          />

          <ResizablePanel
            className="mr-1.5 overflow-hidden!"
            groupResizeBehavior="preserve-relative-size"
            id="workspace-content"
            minSize="60rem"
          >
            <AppLayoutMain />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <AppLayoutFooter />
    </main>
  );
}

export { AppLayout };
