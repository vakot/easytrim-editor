import { Button } from "@/components/ui/button";
import {
  PersistedResizablePanelGroup,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelContextProvider,
  ResizablePanelToggle,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

function Playground() {
  return (
    <ResizablePanelContextProvider>
      <main>
        <PersistedResizablePanelGroup id="workspace">
          <ResizablePanel
            id="workspace-panel-1"
            defaultSize="32.5"
            minSize="25"
            maxSize="40"
            collapsible
          >
            <PersistedResizablePanelGroup id="pane-view" orientation="vertical">
              <ResizablePanel id="pane-view-1" disableCollapsed collapsedSize={28} minSize={120}>
                <ResizablePanelToggle panelId="pane-view-1">
                  {(isCollapsed) => (
                    <Button variant="ghost" size="xs" className="px-2 justify-baseline w-full">
                      <ChevronDown className={cn(isCollapsed && "-rotate-90")} />
                      Toggle 1
                    </Button>
                  )}
                </ResizablePanelToggle>
              </ResizablePanel>

              <ResizableHandle />

              <ResizablePanel id="pane-view-2" disableCollapsed collapsedSize={28} minSize={120}>
                <ResizablePanelToggle panelId="pane-view-2">
                  {(isCollapsed) => (
                    <Button variant="ghost" size="xs" className="px-2 justify-baseline w-full">
                      <ChevronDown className={cn(isCollapsed && "-rotate-90")} />
                      Toggle 2
                    </Button>
                  )}
                </ResizablePanelToggle>
              </ResizablePanel>

              <ResizableHandle />

              <ResizablePanel id="pane-view-3" disableCollapsed collapsedSize={28} minSize={120}>
                <ResizablePanelToggle panelId="pane-view-3">
                  {(isCollapsed) => (
                    <Button variant="ghost" size="xs" className="px-2 justify-baseline w-full">
                      <ChevronDown className={cn(isCollapsed && "-rotate-90")} />
                      Toggle 3
                    </Button>
                  )}
                </ResizablePanelToggle>
              </ResizablePanel>

              <ResizablePanel id="pane-view-4" />
            </PersistedResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel id="workspace-panel-2">
            <PersistedResizablePanelGroup id="preview" orientation="vertical">
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
            </PersistedResizablePanelGroup>
          </ResizablePanel>
        </PersistedResizablePanelGroup>
      </main>
    </ResizablePanelContextProvider>
  );
}

export { Playground };
