import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { useApplicationCommand } from "@/app/hooks/useApplicationCommands";
import { AppLayoutPanel } from "@/app/layout/components/AppLayoutPanel";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectLayoutDensity } from "@/app/store/slices/preferences-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { ExportActions } from "@/features/export";
import { Preview } from "@/features/preview";
import { SourceBreadcrumb } from "@/features/source";
import { TimelinePanel } from "@/features/timeline";
import { cn } from "@/lib/class-names.utils";

import { useSidebarVisibility } from "../hooks/useSidebarVisibility";

type PanelSizes = {
  collapsedSize: string;
  defaultSize: string;
  maxSize: string;
  minSize: string;
};

const getTimelinePanelSize = (isCompact: boolean): PanelSizes => {
  const size = `${isCompact ? 9.3 : 9.425}rem`;
  return { collapsedSize: size, defaultSize: size, maxSize: size, minSize: size };
};

function AppLayoutMain() {
  const media = useAppSelector(selectSourceMedia);
  const bottomPanelCommand = useApplicationCommand("toggle-bottom-panel");
  const layoutDensity = useAppSelector(selectLayoutDensity);
  const { leftSidebarVisible, rightSidebarVisible } = useSidebarVisibility();

  const isCompact = layoutDensity === "compact";

  return (
    <div className="size-full min-h-0" data-slot="timeline-pane">
      <ResizablePanelGroup
        className="*:data-panel:transition-[flex-grow,flex-basis] *:data-panel:duration-200 *:data-panel:ease-out has-data-[separator=active]:*:data-panel:transition-none motion-reduce:*:data-panel:transition-none"
        id="editor-stage"
        orientation="vertical"
        persisted
      >
        <ResizablePanel id="editor-stage-preview" minSize="14rem">
          <AppLayoutPanel
            className={cn(
              "flex flex-col bg-preview-surface layout-compact:border-t",
              !leftSidebarVisible && "layout-compact:rounded-tl-xl layout-compact:border-l",
              !rightSidebarVisible && "layout-compact:rounded-tr-xl layout-compact:border-r",
            )}
            layoutRegion="workspace-preview"
          >
            <div className="flex min-w-0 items-center justify-between p-1">
              <ScrollArea
                className="min-w-0 flex-1"
                fadeColor="var(--preview-surface)"
                orientation="horizontal"
                scrollbarClassName="data-horizontal:h-0.75 data-horizontal:border-t-0 data-horizontal:p-0"
              >
                <SourceBreadcrumb className="h-full min-w-max px-2 py-1" />
              </ScrollArea>

              <ExportActions />
            </div>

            <Separator className="bg-foreground/10" />
            <Preview />
          </AppLayoutPanel>
        </ResizablePanel>

        <ResizableHandle
          className="workspace-separator layout-default:bg-transparent"
          disabled={!media}
          style={isCompact ? undefined : { height: "0.375rem" }}
          withHandle={!!media && !isCompact}
        />

        <ResizablePanel
          collapsible={bottomPanelCommand.enabled}
          groupResizeBehavior="preserve-pixel-size"
          id="editor-stage-timeline"
          {...getTimelinePanelSize(isCompact)}
        >
          <AppLayoutPanel
            className={cn(
              "layout-compact:border-b",
              !leftSidebarVisible && "layout-compact:rounded-bl-xl layout-compact:border-l",
              !rightSidebarVisible && "layout-compact:rounded-br-xl layout-compact:border-r",
            )}
            layoutRegion="workspace-timeline"
          >
            <TimelinePanel />
          </AppLayoutPanel>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export { AppLayoutMain };
