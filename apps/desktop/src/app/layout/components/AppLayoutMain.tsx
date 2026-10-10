import { type RefObject, useCallback, useLayoutEffect, useRef } from "react";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
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
import { SourceBreadcrumb } from "@/features/source";
import { TimelinePanel } from "@/features/timeline";
import { cn } from "@/lib/class-names.utils";
import { syncTimelineGeometry } from "@/lib/interaction/timeline-geometry.utils";

import { useSidebarVisibility } from "../hooks/useSidebarVisibility";

type PanelSizes = {
  collapsedSize: string;
  defaultSize: string;
  maxSize: string;
  minSize: string;
};

const TIMELINE_PANEL_DEFAULT_SIZE_REM = 9.425;
const TIMELINE_PANEL_COMPACT_SIZE_REM = TIMELINE_PANEL_DEFAULT_SIZE_REM - 0.125;

const AUDIO_PANEL_SIZE_LINE_REM = 3.625;
const AUDIO_PANEL_SIZE_MIN_REM = 7.075;

const getTimelinePanelSize = (lines: number = 0, isCompact = false): PanelSizes => {
  const minSizeRem = isCompact ? TIMELINE_PANEL_COMPACT_SIZE_REM : TIMELINE_PANEL_DEFAULT_SIZE_REM;

  if (lines === 0) {
    const size = `${minSizeRem}rem`;
    return {
      minSize: size,
      defaultSize: size,
      maxSize: size,
      collapsedSize: size,
    };
  }

  const audioPanelSizeMaxRem = AUDIO_PANEL_SIZE_MIN_REM + (lines - 1) * AUDIO_PANEL_SIZE_LINE_REM;

  return {
    collapsedSize: `${minSizeRem}rem`,
    minSize: `${minSizeRem + AUDIO_PANEL_SIZE_MIN_REM}rem`,
    defaultSize: `${minSizeRem + AUDIO_PANEL_SIZE_MIN_REM}rem`,
    maxSize: `${minSizeRem + audioPanelSizeMaxRem}rem`,
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
  const layoutDensity = useAppSelector(selectLayoutDensity);
  const { leftSidebarVisible, rightSidebarVisible } = useSidebarVisibility();

  const timelinePaneRef = useRef<HTMLDivElement>(null);

  const isCompact = layoutDensity === "compact";

  const initializeTimelinePane = useCallback((element: HTMLDivElement | null) => {
    timelinePaneRef.current = element;
    syncTimelineGeometry(element, EMPTY_TIMELINE_RANGE);
  }, []);

  return (
    <div className="size-full min-h-0" data-slot="timeline-pane" ref={initializeTimelinePane}>
      <TimelineGeometrySync targetRef={timelinePaneRef} />

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
          collapsible={audioStreamsCount > 0}
          groupResizeBehavior="preserve-pixel-size"
          id="editor-stage-timeline"
          {...getTimelinePanelSize(audioStreamsCount, isCompact)}
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
