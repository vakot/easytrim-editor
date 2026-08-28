import { LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

import { usePlayback } from "@/app/hooks/usePlayback";
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
    <ResizablePanelGroup id="editor-stage" persisted orientation="vertical">
      <ResizablePanel id="editor-stage-preview" minSize="14rem" className="overflow-hidden">
        <div className="relative rounded-md border border-border h-full overflow-hidden bg-preview-surface">
          <Preview />
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle style={{ height: 4 }} className="bg-transparent" />
      <ResizablePanel
        id="editor-stage-timeline"
        panelRef={timelinePanelSizing.panelRef}
        defaultSize={timelinePanelSizing.initialDefaultSize}
        collapsible
        collapsedSize={timelinePanelSizing.collapsedSize}
        minSize={timelinePanelSizing.constraints.minSize}
        maxSize={timelinePanelSizing.constraints.maxSize}
        className="overflow-hidden pb-1"
        groupResizeBehavior="preserve-pixel-size"
      >
        <div className="relative rounded-md border border-border h-full overflow-hidden bg-card/30">
          <EditorTimelinePanel />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function EditorTimelinePanel() {
  const { t } = useTranslation();
  const sourceSelection = useAppSelector(selectSourceSelection);
  const media = useAppSelector(selectSourceMedia);
  const trim = useAppSelector(selectTrim);
  const playback = usePlayback();

  return (
    <>
      <TimelinePane
        range={trim ?? EMPTY_TIMELINE_RANGE}
        timeline={<Timeline />}
        audio={media?.audioStreams.length ? <AudioPanel /> : null}
      />
      {sourceSelection !== null && !playback.isReady ? (
        <div
          className="absolute inset-0 z-30 grid place-items-center bg-background/75 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          data-testid="editor-loading-overlay"
        >
          <div className="grid place-items-center gap-2 text-center text-sm text-muted-foreground">
            <LoaderCircle className="size-7 animate-spin text-primary" aria-hidden="true" />
            <strong className="text-foreground">{t("common.loading")}</strong>
          </div>
        </div>
      ) : null}
    </>
  );
}
