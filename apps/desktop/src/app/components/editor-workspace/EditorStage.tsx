import { Card } from "@/components/ui/card";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceMedia, selectSourceSelection } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { AudioPanel } from "@/features/audio";
import { Preview } from "@/features/preview";
import { Timeline } from "@/features/timeline";

import { useTimelinePanelSizing } from "./hooks/useTimelinePanelSizing";
import { TimelinePane } from "./TimelinePane";

const EMPTY_TIMELINE_RANGE = {
  startMicros: 0,
  endMicros: 1_000_000,
  sourceDurationMicros: 1_000_000,
} as const;

export function EditorStage() {
  const sourceSelection = useAppSelector(selectSourceSelection);
  const media = useAppSelector(selectSourceMedia);
  const timelinePanelSizing = useTimelinePanelSizing(
    sourceSelection !== null,
    media?.audioStreams.length ?? null,
  );

  return (
    <ResizablePanelGroup id="editor-stage" orientation="vertical" persisted>
      <ResizablePanel className="overflow-hidden" id="editor-stage-preview" minSize="14rem">
        <Card className="size-full border border-foreground/10 bg-preview-surface p-0 ring-0">
          <Preview />
        </Card>
      </ResizablePanel>
      <ResizableHandle className="bg-transparent" style={{ height: 4 }} withHandle />
      <ResizablePanel
        className="overflow-hidden pb-1"
        collapsedSize={timelinePanelSizing.collapsedSize}
        collapsible
        defaultSize={timelinePanelSizing.initialDefaultSize}
        groupResizeBehavior="preserve-pixel-size"
        id="editor-stage-timeline"
        maxSize={timelinePanelSizing.constraints.maxSize}
        minSize={timelinePanelSizing.constraints.minSize}
        panelRef={timelinePanelSizing.panelRef}
      >
        <Card className="size-full border border-foreground/10 p-0 ring-0">
          <EditorTimelinePanel />
        </Card>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function EditorTimelinePanel() {
  const media = useAppSelector(selectSourceMedia);
  const trim = useAppSelector(selectTrim);

  return (
    <>
      <TimelinePane
        audio={media?.audioStreams.length ? <AudioPanel /> : null}
        range={trim ?? EMPTY_TIMELINE_RANGE}
        timeline={<Timeline />}
      />
    </>
  );
}
