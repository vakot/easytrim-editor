import { type RefObject, useCallback, useLayoutEffect, useRef } from "react";

import { Card } from "@/components/ui/card";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAudioPanelStreamCount, selectSourceMedia } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { AudioPanel } from "@/features/audio";
import { Preview } from "@/features/preview";
import { SourceBreadcrumb, SourceTabs } from "@/features/source";
import { TimelinePanel } from "@/features/timeline";
import { syncTimelineGeometry } from "@/lib/interaction/timeline-geometry.utils";

type PanelSizes = {
  collapsedSize: number;
  defaultSize: number;
  maxSize: number;
  minSize: number;
};

const TIMELINE_PANEL_DEFAULT_SIZE = 160;

const AUDIO_PANEL_SIZE_LINE = 58;
const AUDIO_PANEL_SIZE_MIN = 126;

const getTimelinePanelSize = (lines: number = 0): PanelSizes => {
  if (lines === 0) {
    return {
      minSize: TIMELINE_PANEL_DEFAULT_SIZE,
      defaultSize: TIMELINE_PANEL_DEFAULT_SIZE,
      maxSize: TIMELINE_PANEL_DEFAULT_SIZE,
      collapsedSize: TIMELINE_PANEL_DEFAULT_SIZE,
    };
  }

  const audioPanelSizeMax = AUDIO_PANEL_SIZE_MIN + (lines - 1) * AUDIO_PANEL_SIZE_LINE;

  return {
    collapsedSize: TIMELINE_PANEL_DEFAULT_SIZE,
    minSize: TIMELINE_PANEL_DEFAULT_SIZE + AUDIO_PANEL_SIZE_MIN,
    defaultSize: TIMELINE_PANEL_DEFAULT_SIZE + AUDIO_PANEL_SIZE_MIN,
    maxSize: TIMELINE_PANEL_DEFAULT_SIZE + audioPanelSizeMax,
  };
};

const EMPTY_TIMELINE_RANGE = {
  startMicros: 0,
  endMicros: 1_000_000,
  sourceDurationMicros: 1_000_000,
} as const;

export function EditorStage() {
  const media = useAppSelector(selectSourceMedia);
  const audioStreamsCount = useAppSelector(selectAudioPanelStreamCount);
  const timelinePaneRef = useRef<HTMLDivElement>(null);

  const initializeTimelinePane = useCallback((element: HTMLDivElement | null) => {
    timelinePaneRef.current = element;
    syncTimelineGeometry(element, EMPTY_TIMELINE_RANGE);
  }, []);

  return (
    <div className="size-full min-h-0" data-slot="timeline-pane" ref={initializeTimelinePane}>
      <TimelineGeometrySync targetRef={timelinePaneRef} />
      <ResizablePanelGroup id="editor-stage" orientation="vertical" persisted>
        <ResizablePanel id="editor-stage-preview" minSize="14rem">
          <div className="size-full p-px">
            <Card className="size-full gap-0 bg-preview-surface p-0">
              <div className="h-14">
                <ScrollArea
                  className="h-8 w-full min-w-0 px-1"
                  fadeColor="var(--preview-surface)"
                  orientation="horizontal"
                  scrollbarClassName="data-horizontal:h-1.25"
                >
                  <SourceTabs />
                </ScrollArea>
                <SourceBreadcrumb />
              </div>
              <Separator className="bg-foreground/10" />
              <Preview />
            </Card>
          </div>
        </ResizablePanel>

        <ResizableHandle
          className="bg-transparent"
          disabled={!media}
          style={{ height: 6 }}
          withHandle={!!media}
        />

        <ResizablePanel
          className="pb-1.5"
          collapsible={audioStreamsCount > 0}
          groupResizeBehavior="preserve-pixel-size"
          id="editor-stage-timeline"
          {...getTimelinePanelSize(audioStreamsCount)}
        >
          <div className="size-full p-px">
            <Card className="size-full gap-0 p-0">
              <TimelinePanel />
              {audioStreamsCount > 0 && <AudioPanel />}
            </Card>
          </div>
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
