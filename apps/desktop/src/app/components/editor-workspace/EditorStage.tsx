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

const AUDIO_PANEL_SIZE_DEFAULT = 93;
const AUDIO_PANEL_SIZE_LINE = 56;
const AUDIO_PANEL_SIZE_PLACEHOLDER = 0;

const getAudioPanelSize = (lines: number = 0): PanelSizes => {
  const audioPanelWithPlaceholder = AUDIO_PANEL_SIZE_DEFAULT + AUDIO_PANEL_SIZE_PLACEHOLDER;
  return {
    minSize: audioPanelWithPlaceholder + AUDIO_PANEL_SIZE_LINE,
    defaultSize: audioPanelWithPlaceholder + AUDIO_PANEL_SIZE_LINE,
    maxSize: audioPanelWithPlaceholder + lines * AUDIO_PANEL_SIZE_LINE,
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
        <Card className="size-full p-3 ring-inset">
          <TimelinePanel />
        </Card>
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
            <Card className="size-full py-3 ring-inset">
              <AudioPanel />
            </Card>
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}
