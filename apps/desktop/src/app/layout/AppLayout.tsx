import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  usePanelState,
} from "@/components/ui/resizable";

import { AppLayoutFooter } from "@/app/layout/components/AppLayoutFooter";
import { AppLayoutHeader } from "@/app/layout/components/AppLayoutHeader";
import { AppLayoutPanel } from "@/app/layout/components/AppLayoutPanel";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectLayoutDensity } from "@/app/store/slices/preferences-slice";
import { cn } from "@/lib/class-names.utils";

import { AppLayoutMain } from "./components/AppLayoutMain";
import { AppLayoutSidebar } from "./components/AppLayoutSidebar";

function AppLayout() {
  const { isCollapsed } = usePanelState("workspace-sidebar");
  const layoutDensity = useAppSelector(selectLayoutDensity);
  const isCompact = layoutDensity === "compact";

  return (
    <main className="fixed inset-0 grid h-dvh w-screen min-w-80 grid-rows-[2.25rem_minmax(0,1fr)_auto] overflow-hidden bg-background">
      <AppLayoutHeader />

      <ResizablePanelGroup id="workspace" persisted>
        <ResizablePanel
          className="ml-1.5 overflow-hidden!"
          collapsedSize={0}
          collapsible
          defaultSize="30.75rem"
          groupResizeBehavior="preserve-pixel-size"
          id="workspace-sidebar"
          maxSize="48rem"
          minSize="30.75rem"
        >
          <AppLayoutPanel className="layout-compact:rounded-l-xl layout-compact:border-r-0">
            <AppLayoutSidebar />
          </AppLayoutPanel>
        </ResizablePanel>

        <ResizableHandle
          className={cn(
            "self-start layout-default:bg-transparent",
            isCollapsed && "bg-transparent",
          )}
          style={isCompact && !isCollapsed ? undefined : { width: 6 }}
          withHandle={!isCompact || isCollapsed}
        />

        <ResizablePanel
          className="mr-1.5 overflow-hidden!"
          groupResizeBehavior="preserve-relative-size"
          id="workspace-content"
          minSize="40rem"
        >
          <AppLayoutMain />
        </ResizablePanel>
      </ResizablePanelGroup>

      <AppLayoutFooter />
    </main>
  );
}

export { AppLayout };
