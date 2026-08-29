import { Card } from "@/components/ui/card";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { AudioPanel } from "@/features/audio";
import { Preview } from "@/features/preview";
import { SourceDropOverlay } from "@/features/source";
import { TimelinePanel } from "@/features/timeline";
import { cn } from "@/lib/class-names.utils";
import { timelineGeometryStyle } from "@/lib/interaction/timeline-geometry.utils";

type PanelSizes = {
  defaultSize?: number;
  maxSize: number;
  minSize: number;
};

const TIMELINE_PANEL_SIZE: PanelSizes = {
  maxSize: 152,
  minSize: 152,
};

const AUDIO_PANEL_SIZE_MIN = 144;
const AUDIO_PANEL_SIZE_DEFAULT = 115;
const AUDIO_PANEL_SIZE_LINE = 51;

const getAudioPanelSize = (lines: number = 0): PanelSizes => {
  const audioPanelSizeMax = AUDIO_PANEL_SIZE_DEFAULT + lines * AUDIO_PANEL_SIZE_LINE;
  return {
    minSize: AUDIO_PANEL_SIZE_MIN,
    defaultSize: lines > 0 ? AUDIO_PANEL_SIZE_MIN : AUDIO_PANEL_SIZE_DEFAULT,
    maxSize: audioPanelSizeMax,
  };
};

const EMPTY_TIMELINE_RANGE = {
  startMicros: 0,
  endMicros: 1_000_000,
  sourceDurationMicros: 1_000_000,
} as const;

export function EditorStage() {
  const media = useAppSelector(selectSourceMedia);
  const trim = useAppSelector(selectTrim);
  const audioStreamsCount = media?.audioStreams.length ?? 0;

  return (
    <ResizablePanelGroup
      id="editor-stage"
      orientation="vertical"
      persisted
      style={timelineGeometryStyle(trim ?? EMPTY_TIMELINE_RANGE)}
    >
      <ResizablePanel className="overflow-hidden" id="editor-stage-preview" minSize="14rem">
        <Card className="size-full bg-preview-surface p-0 ring-inset">
          <SourceDropOverlay />
          <Preview />
        </Card>
      </ResizablePanel>
      <ResizableHandle className="bg-transparent" style={{ height: 4 }} withHandle />
      <ResizablePanel
        className={cn("overflow-hidden", !audioStreamsCount && "pb-1")}
        groupResizeBehavior="preserve-pixel-size"
        id="editor-stage-timeline"
        {...TIMELINE_PANEL_SIZE}
      >
        <TimelinePanel />
      </ResizablePanel>
      {audioStreamsCount > 0 && (
        <>
          <ResizableHandle className="bg-transparent" style={{ height: 4 }} withHandle />
          <ResizablePanel
            className="overflow-hidden pb-1"
            collapsedSize={0}
            collapsible
            defaultSize={AUDIO_PANEL_SIZE_DEFAULT}
            groupResizeBehavior="preserve-pixel-size"
            id="editor-stage-audio"
            {...getAudioPanelSize(audioStreamsCount)}
          >
            <AudioPanel />
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}
