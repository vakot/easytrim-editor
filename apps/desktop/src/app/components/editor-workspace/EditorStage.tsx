import { Card } from "@/components/ui/card";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { AudioPanel } from "@/features/audio";
import { Preview } from "@/features/preview";
import { TimelinePanel } from "@/features/timeline";
import { cn } from "@/lib/class-names.utils";
import { timelineGeometryStyle } from "@/lib/interaction/timeline-geometry.utils";

type PanelSizes = {
  defaultSize?: number;
  maxSize: number;
  minSize: number;
};

const TIMELINE_PANEL_SIZE: PanelSizes = {
  maxSize: 154,
  minSize: 154,
};

const AUDIO_PANEL_SIZE_LINE = 58;
const AUDIO_PANEL_SIZE_MIN = 146;

/** lines > 0 */
const getAudioPanelSize = (lines: number = 1): PanelSizes => {
  const audioPanelSizeMax = AUDIO_PANEL_SIZE_MIN + (lines - 1) * AUDIO_PANEL_SIZE_LINE + 1;
  return {
    minSize: AUDIO_PANEL_SIZE_MIN,
    defaultSize: AUDIO_PANEL_SIZE_MIN,
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
      <ResizablePanel id="editor-stage-preview" minSize="14rem">
        <div className="size-full p-px">
          <Card className="size-full bg-preview-surface p-0">
            <Preview />
          </Card>
        </div>
      </ResizablePanel>

      <ResizableHandle className="bg-transparent" style={{ height: 6 }} withHandle />

      <ResizablePanel
        className={cn(!audioStreamsCount && "pb-1.5")}
        groupResizeBehavior="preserve-pixel-size"
        id="editor-stage-timeline"
        {...TIMELINE_PANEL_SIZE}
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
  );
}
