import { useState } from "react";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

import { AppLayoutFooter } from "@/app/layout/components/AppLayoutFooter";
import { AppLayoutHeader } from "@/app/layout/components/AppLayoutHeader";
import { AppLayoutPanel } from "@/app/layout/components/AppLayoutPanel";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectLayoutDensity } from "@/app/store/slices/preferences-slice";
import { cn } from "@/lib/class-names.utils";

import { AppLayoutMain } from "./components/AppLayoutMain";
import { AppLayoutSidebar } from "./components/AppLayoutSidebar";

function AppLayout() {
  const layoutDensity = useAppSelector(selectLayoutDensity);
  const isCompact = layoutDensity === "compact";
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <main className="fixed inset-0 grid h-dvh w-screen min-w-80 grid-rows-[2.25rem_minmax(0,1fr)_auto] overflow-hidden bg-background">
      <AppLayoutHeader />

      <ResizablePanelGroup id="workspace" persisted>
        <ResizablePanel
          className="overflow-hidden layout-default:pl-1.5"
          collapsedSize={0}
          collapsible
          defaultSize="30.75rem" // matches 16x9 preview perfectly
          groupResizeBehavior="preserve-pixel-size"
          id="workspace-sidebar"
          maxSize="48rem"
          minSize="30.75rem" // matches 16x9 preview perfectly
          onResize={(size) => setIsSidebarCollapsed(size.asPercentage === 0)}
        >
          <AppLayoutPanel>
            <AppLayoutSidebar />
          </AppLayoutPanel>
        </ResizablePanel>

        <ResizableHandle
          className={cn(
            "self-start layout-default:bg-transparent",
            isSidebarCollapsed && "bg-transparent",
          )}
          style={isCompact ? undefined : { width: 6 }}
          withHandle
        />

        <ResizablePanel
          className="overflow-hidden layout-default:pr-1.5"
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
