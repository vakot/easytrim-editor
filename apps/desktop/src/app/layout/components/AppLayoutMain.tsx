import { type RefObject, useCallback, useLayoutEffect, useRef } from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  usePanelState,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { AppLayoutPanel } from "@/app/layout/components/AppLayoutPanel";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectLayoutDensity } from "@/app/store/slices/preferences-slice";
import { selectAudioPanelStreamCount, selectSourceMedia } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { AudioPanel } from "@/features/audio";
import { ExportActions } from "@/features/export";
import { Preview } from "@/features/preview";
import { SourceBreadcrumb, SourceTabs } from "@/features/source";
import { TimelinePanel } from "@/features/timeline";
import { cn } from "@/lib/class-names.utils";
import { syncTimelineGeometry } from "@/lib/interaction/timeline-geometry.utils";

type PanelSizes = {
  collapsedSize: number;
  defaultSize: number;
  maxSize: number;
  minSize: number;
};

const TIMELINE_PANEL_DEFAULT_SIZE = 154;

const AUDIO_PANEL_SIZE_LINE = 58;
const AUDIO_PANEL_SIZE_MIN = 125;

const getTimelinePanelSize = (lines: number = 0, isCompact = false): PanelSizes => {
  const minSize = isCompact ? TIMELINE_PANEL_DEFAULT_SIZE - 1 : TIMELINE_PANEL_DEFAULT_SIZE;

  if (lines === 0) {
    return {
      minSize,
      defaultSize: minSize,
      maxSize: minSize,
      collapsedSize: minSize,
    };
  }

  const audioPanelSizeMax = AUDIO_PANEL_SIZE_MIN + (lines - 1) * AUDIO_PANEL_SIZE_LINE;

  return {
    collapsedSize: minSize,
    minSize: minSize + AUDIO_PANEL_SIZE_MIN,
    defaultSize: minSize + AUDIO_PANEL_SIZE_MIN,
    maxSize: minSize + audioPanelSizeMax,
  };
};

const EMPTY_TIMELINE_RANGE = {
  startMicros: 0,
  endMicros: 1_000_000,
  sourceDurationMicros: 1_000_000,
} as const;

function AppLayoutMain() {
  const media = useAppSelector(selectSourceMedia);
  const audioStreamsCount = useAppSelector(selectAudioPanelStreamCount);
  const { isCollapsed: isSidebarCollapsed } = usePanelState("workspace-sidebar");

  const timelinePaneRef = useRef<HTMLDivElement>(null);
  const layoutDensity = useAppSelector(selectLayoutDensity);

  const isCompact = layoutDensity === "compact";

  const initializeTimelinePane = useCallback((element: HTMLDivElement | null) => {
    timelinePaneRef.current = element;
    syncTimelineGeometry(element, EMPTY_TIMELINE_RANGE);
  }, []);

  return (
    <div className="size-full min-h-0" data-slot="timeline-pane" ref={initializeTimelinePane}>
      <TimelineGeometrySync targetRef={timelinePaneRef} />

      <ResizablePanelGroup id="editor-stage" orientation="vertical" persisted>
        <ResizablePanel id="editor-stage-preview" minSize="14rem">
          <AppLayoutPanel
            className={cn(
              "flex flex-col bg-preview-surface layout-compact:rounded-tr-xl layout-compact:border-b-0",
              isSidebarCollapsed ? "layout-compact:rounded-tl-xl" : "layout-compact:border-l-0",
            )}
          >
            <div className="grid h-16 min-w-0 shrink-0 px-1">
              <div className="flex h-9 min-w-0 items-center gap-1.5">
                <ScrollArea
                  className="mt-0.5 min-w-0 flex-1 pb-0.5"
                  fadeColor="var(--preview-surface)"
                  orientation="horizontal"
                  scrollbarClassName="data-horizontal:h-1.25"
                >
                  <SourceTabs />
                </ScrollArea>
                <ExportActions />
              </div>
              <SourceBreadcrumb />
            </div>
            <Separator className="bg-foreground/10" />
            <Preview />
          </AppLayoutPanel>
        </ResizablePanel>

        <ResizableHandle
          className="layout-default:bg-transparent"
          disabled={!media}
          style={isCompact ? undefined : { height: 6 }}
          withHandle={!!media && !isCompact}
        />

        <ResizablePanel
          collapsible={audioStreamsCount > 0}
          groupResizeBehavior="preserve-pixel-size"
          id="editor-stage-timeline"
          {...getTimelinePanelSize(audioStreamsCount, isCompact)}
        >
          <AppLayoutPanel
            className={cn(
              "layout-compact:rounded-br-xl layout-compact:border-t-0",
              isSidebarCollapsed ? "layout-compact:rounded-bl-xl" : "layout-compact:border-l-0",
            )}
          >
            <TimelinePanel />
            {audioStreamsCount > 0 && <AudioPanel />}
          </AppLayoutPanel>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function TimelineGeometrySync({ targetRef }: { targetRef: RefObject<HTMLElement | null> }) {
  const trim = useAppSelector(selectTrim);

  useLayoutEffect(() => {
    syncTimelineGeometry(targetRef.current, trim ?? EMPTY_TIMELINE_RANGE);
  }, [targetRef, trim]);

  return null;
}

export { AppLayoutMain };
