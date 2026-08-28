import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelContextProvider,
  ResizablePanelControl,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

function Playground() {
  return (
    <ResizablePanelContextProvider>
      <main>
        <ResizablePanelGroup id="workspace" persisted>
          <ResizablePanel
            id="workspace-panel-1"
            defaultSize="32.5"
            minSize="25"
            maxSize="40"
            collapsible
          >
            <ResizablePanelGroup id="pane-view" persisted orientation="vertical">
              <ResizablePanel id="pane-view-1" collapsible collapsedSize={24} minSize={120}>
                <ResizablePanelControl panelId="pane-view-1">
                  {({ isCollapsed }) => (
                    <Button variant="ghost" size="xs" className="px-2 justify-baseline w-full">
                      <ChevronDown className={cn(isCollapsed && "-rotate-90")} />
                      Toggle 1
                    </Button>
                  )}
                </ResizablePanelControl>
              </ResizablePanel>

              <ResizableHandle />

              <ResizablePanel id="pane-view-2" collapsible collapsedSize={24} minSize={120}>
                <ResizablePanelControl panelId="pane-view-2">
                  {({ isCollapsed }) => (
                    <Button variant="ghost" size="xs" className="px-2 justify-baseline w-full">
                      <ChevronDown className={cn(isCollapsed && "-rotate-90")} />
                      Toggle 2
                    </Button>
                  )}
                </ResizablePanelControl>
              </ResizablePanel>

              <ResizableHandle />

              <ResizablePanel id="pane-view-3" collapsible collapsedSize={24} minSize={120}>
                <ResizablePanelControl panelId="pane-view-3">
                  {({ isCollapsed }) => (
                    <Button variant="ghost" size="xs" className="px-2 justify-baseline w-full">
                      <ChevronDown className={cn(isCollapsed && "-rotate-90")} />
                      Toggle 3
                    </Button>
                  )}
                </ResizablePanelControl>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel id="workspace-panel-2">
            <ResizablePanelGroup id="preview" persisted orientation="vertical">
              <ResizablePanel id="preview-panel-1">2</ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel
                id="preview-panel-2"
                defaultSize="30"
                minSize="20"
                maxSize="40"
                collapsible
              >
                3
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </ResizablePanelContextProvider>
  );
}

export { Playground };
