import { useLayoutEffect } from "react";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

import { AppLayoutFooter } from "@/app/layout/components/AppLayoutFooter";
import { AppLayoutHeader } from "@/app/layout/components/AppLayoutHeader";
import { AppLayoutPanel } from "@/app/layout/components/AppLayoutPanel";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectLayoutDensity, selectUiScalePercent } from "@/app/store/slices/preferences-slice";

import { AppLayoutMain } from "./components/AppLayoutMain";
import { AppLayoutSidebar } from "./components/AppLayoutSidebar";

function AppLayout() {
  const layoutDensity = useAppSelector(selectLayoutDensity);
  const uiScalePercent = useAppSelector(selectUiScalePercent);
  const isCompact = layoutDensity === "compact";

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousFontSize = root.style.fontSize;
    root.style.fontSize = `${uiScalePercent}%`;
    return () => {
      root.style.fontSize = previousFontSize;
    };
  }, [uiScalePercent]);

  return (
    <main className="fixed inset-0 grid h-dvh w-screen min-w-80 grid-rows-[2.25rem_minmax(0,1fr)_auto] overflow-hidden bg-background">
      <AppLayoutHeader />

      <ResizablePanelGroup id="workspace" persisted>
        <ResizablePanel
          className="ml-1.5 overflow-hidden!"
          collapsedSize={0}
          collapsible
          defaultSize="30rem"
          groupResizeBehavior="preserve-pixel-size"
          id="workspace-sidebar"
          maxSize="30rem"
          minSize="25rem"
        >
          <AppLayoutPanel className="layout-compact:rounded-l-xl layout-compact:border-r-0">
            <AppLayoutSidebar />
          </AppLayoutPanel>
        </ResizablePanel>

        <ResizableHandle
          className="workspace-separator self-start layout-default:bg-transparent"
          style={isCompact ? undefined : { width: "0.375rem" }}
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

      <AppLayoutFooter />
    </main>
  );
}

export { AppLayout };
