import { type RefObject, useCallback, useLayoutEffect, useRef } from "react";

import { Card } from "@/components/ui/card";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAudioPanelStreamCount, selectSourceMedia } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { AudioPanel } from "@/features/audio";
import { Preview } from "@/features/preview";
import { SourceTabs } from "@/features/source";
import { TimelinePanel } from "@/features/timeline";
import { cn } from "@/lib/class-names.utils";
import { syncTimelineGeometry } from "@/lib/interaction/timeline-geometry.utils";

type PanelSizes = {
  defaultSize?: number;
  maxSize: number;
  minSize: number;
};

const TIMELINE_PANEL_DEFAULT_SIZE = 160;
const TIMELINE_PANEL_SECONDARY_SIZE = 154;

const AUDIO_PANEL_SIZE_LINE = 58;
const AUDIO_PANEL_SIZE_MIN = 146;

const getAudioPanelSize = (lines: number = 1): PanelSizes => {
  const audioPanelSizeMax = AUDIO_PANEL_SIZE_MIN + (lines - 1) * AUDIO_PANEL_SIZE_LINE;
  return {
    minSize: AUDIO_PANEL_SIZE_MIN,
    defaultSize: AUDIO_PANEL_SIZE_MIN,
    maxSize: audioPanelSizeMax,
  };
};

const getTimelinePanelSize = (hasAudio: boolean = false): PanelSizes => {
  const size = hasAudio ? TIMELINE_PANEL_SECONDARY_SIZE : TIMELINE_PANEL_DEFAULT_SIZE;
  return {
    minSize: size,
    defaultSize: size,
    maxSize: size,
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
              <div>
                <SourceTabs />
              </div>
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
          className={cn(!audioStreamsCount && "pb-1.5")}
          groupResizeBehavior="preserve-pixel-size"
          id="editor-stage-timeline"
          {...getTimelinePanelSize(audioStreamsCount > 0)}
        >
          <div className="size-full p-px">
            <Card className="size-full p-0">
              <TimelinePanel />
            </Card>
          </div>
        </ResizablePanel>

        {audioStreamsCount > 0 && (
          <>
            <ResizableHandle className="bg-transparent" style={{ height: 6 }} withHandle />

            <ResizablePanel
              className="pb-1.5"
              collapsedSize={0}
              collapsible
              groupResizeBehavior="preserve-pixel-size"
              id="editor-stage-audio"
              {...getAudioPanelSize(audioStreamsCount)}
            >
              <div className="size-full p-px">
                <Card className="size-full p-0">
                  <AudioPanel />
                </Card>
              </div>
            </ResizablePanel>
          </>
        )}
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
