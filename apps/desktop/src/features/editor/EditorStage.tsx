import { LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { usePlayback, useTimeline } from "@/app/hooks/useEditorContracts";
import { PANEL_GROUP_IDS } from "@/app/panel-layout-runtime";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  audioMergeToggled,
  audioTrackToggled,
  audioTrackVolumeChanged,
  masterAudioToggled,
  masterVolumeChanged,
  selectAudioTracks,
  selectMasterAudio,
  selectMergeAudio,
  waveformDisplayFailed,
} from "@/app/store/slices/audio-slice";
import { PANEL_IDS } from "@/app/store/slices/panel-layout-slice";
import { selectPreview } from "@/app/store/slices/preview-slice";
import {
  selectSourceMedia,
  selectSourceReady,
  selectSourceSelection,
} from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { prepareSourceWaveforms } from "@/app/store/thunks/source-media-thunks";
import {
  Panel,
  PanelHandle,
  PersistedPanelGroup,
  type PanelRegistration,
} from "@/components/layout/panel";
import { PanelContent } from "@/components/layout/panel-content";
import { ResizablePanel } from "@/components/ui/resizable";
import { AudioTracks } from "@/features/audio-tracks";
import {
  PlaybackControls,
  PlaybackTimecode,
  TimelineTools,
} from "@/features/preview/PlaybackControls";
import { VideoPreview } from "@/features/preview/VideoPreview";
import { TrimTimeline } from "@/features/timeline";
import { TimelinePane } from "./components/TimelinePane";
import { useTimelinePanelSizing } from "./hooks/useTimelinePanelSizing";

const EMPTY_TIMELINE_RANGE = {
  startMicros: 0,
  endMicros: 1_000_000,
  sourceDurationMicros: 1_000_000,
} as const;

const STAGE_PANELS = [
  { id: "preview-panel" },
  { id: PANEL_IDS.timeline, panelId: PANEL_IDS.timeline },
] as const satisfies readonly PanelRegistration[];

export function EditorStage() {
  const { t } = useTranslation();
  const sourceSelection = useAppSelector(selectSourceSelection);
  const media = useAppSelector(selectSourceMedia);
  const preview = useAppSelector(selectPreview);
  const trim = useAppSelector(selectTrim);
  const audioTracks = useAppSelector(selectAudioTracks);
  const mergeAudio = useAppSelector(selectMergeAudio);
  const isSourceReady = useAppSelector(selectSourceReady);
  const masterAudio = useAppSelector(selectMasterAudio);
  const playback = usePlayback();
  const timeline = useTimeline();
  const dispatch = useAppDispatch();
  const sourcePath = sourceSelection?.sourcePath ?? null;
  const timelineRange = trim ?? EMPTY_TIMELINE_RANGE;
  const controlsDisabled = !isSourceReady || !playback.isReady;
  const showLoadingOverlay =
    sourceSelection !== null && preview.status !== "failed" && !playback.isReady;

  const timelinePanelSizing = useTimelinePanelSizing(
    sourceSelection !== null,
    media?.audioStreams.length ?? null,
  );

  return (
    <PersistedPanelGroup
      id={PANEL_GROUP_IDS.stage}
      panels={STAGE_PANELS}
      orientation="vertical"
      className="relative min-h-0 min-w-0 bg-background"
      resizeTargetMinimumSize={{ fine: 8, coarse: 24 }}
      aria-label={t("preview.panes")}
      aria-busy={showLoadingOverlay}
    >
      <ResizablePanel id="preview-panel" minSize="14rem" className="min-h-0 min-w-0">
        <PanelContent className="bg-preview-surface">
          <VideoPreview
            hasSource={sourceSelection !== null}
            preview={preview}
            nativeLoopEnabled={playback.nativeLoopEnabled}
            muted={playback.videoMuted}
            videoRef={playback.videoRef}
            onPlaybackError={(previewKind) => playback.onPreviewPlaybackError(previewKind)}
            onLoadedMetadata={playback.onLoadedMetadata}
            onCanPlay={playback.onCanPlay}
            onTogglePlayback={playback.toggle}
            onPlay={playback.onPlay}
            onPause={playback.onPause}
            onTimeUpdate={playback.onTimeUpdate}
            onEnded={playback.onEnded}
            onCropToolOpenChange={playback.onCropToolOpenChange}
          />
        </PanelContent>
      </ResizablePanel>

      <PanelHandle
        panelId={PANEL_IDS.timeline}
        id="preview-timeline-resize-handle"
        aria-label={t("preview.resize")}
        style={{ height: 4 }}
        className="bg-transparent"
      />

      <Panel
        id={PANEL_IDS.timeline}
        panelRef={timelinePanelSizing.panelRef}
        resetSize={timelinePanelSizing.constraints.defaultSize}
        defaultSize={timelinePanelSizing.initialDefaultSize}
        collapsible
        collapsedSize={timelinePanelSizing.collapsedSize}
        minSize={timelinePanelSizing.constraints.minSize}
        maxSize={timelinePanelSizing.constraints.maxSize}
        groupResizeBehavior="preserve-pixel-size"
        className="min-h-0 min-w-0 pb-1"
      >
        {(panel) => (
          <PanelContent>
            <TimelinePane
              range={timelineRange}
              timeline={
                <TrimTimeline
                  range={timelineRange}
                  disabled={controlsDisabled}
                  playheadMicros={timeline.playheadMicros}
                  playheadRef={timeline.playheadRef}
                  frameRate={media?.video.averageFrameRate ?? media?.video.realFrameRate}
                  playbackControls={
                    <PlaybackControls
                      isPlaying={playback.isPlaying}
                      error={playback.transportError}
                      canSetSegmentStart={timeline.canSetSegmentStart}
                      canSetSegmentEnd={timeline.canSetSegmentEnd}
                      disabled={controlsDisabled}
                      onTogglePlayback={playback.toggle}
                      onStepFrame={playback.stepFrame}
                      onSetSegmentBoundary={playback.setSegmentBoundary}
                    />
                  }
                  playbackTimecode={
                    <PlaybackTimecode
                      currentMicros={controlsDisabled ? null : timeline.playheadMicros}
                      sourceDurationMicros={
                        controlsDisabled ? null : timelineRange.sourceDurationMicros
                      }
                      frameRate={media?.video.averageFrameRate ?? media?.video.realFrameRate}
                    />
                  }
                  videoToolbar={<TimelineTools />}
                  onChange={timeline.onChange}
                  onMoveSegment={timeline.onMoveSegment}
                  onTrimDragStart={timeline.onTrimDragStart}
                  onTrimDragEnd={timeline.onTrimDragEnd}
                  onSegmentDragStart={timeline.onSegmentDragStart}
                  onSegmentDragEnd={timeline.onSegmentDragEnd}
                  onSeek={timeline.onSeek}
                  onScrubStart={timeline.onScrubStart}
                  onScrub={timeline.onScrub}
                  onScrubEnd={timeline.onScrubEnd}
                />
              }
              audioTracks={
                !panel.collapsed && (media?.audioStreams.length ?? 0) > 0 ? (
                  <AudioTracks
                    streams={media?.audioStreams ?? []}
                    tracks={audioTracks}
                    masterEnabled={masterAudio.enabled}
                    masterVolumePercent={masterAudio.volumePercent}
                    range={timelineRange}
                    playheadMicros={timeline.playheadMicros}
                    playheadRef={playback.audioPlayheadRef}
                    mergeAudio={mergeAudio}
                    waveformPreparationEnabled={playback.isReady}
                    onToggleTrack={(streamIndex) => dispatch(audioTrackToggled({ streamIndex }))}
                    onTrackVolumeChange={(streamIndex, volumePercent) =>
                      dispatch(audioTrackVolumeChanged({ streamIndex, volumePercent }))
                    }
                    onToggleMaster={() => dispatch(masterAudioToggled())}
                    onMasterVolumeChange={(volumePercent) =>
                      dispatch(masterVolumeChanged({ volumePercent }))
                    }
                    onToggleMerge={() => dispatch(audioMergeToggled())}
                    onPrepareWaveforms={(streamIndexes, width) =>
                      sourcePath &&
                      void dispatch(prepareSourceWaveforms(sourcePath, streamIndexes, width))
                    }
                    onWaveformImageError={(streamIndex) =>
                      dispatch(waveformDisplayFailed({ streamIndex }))
                    }
                  />
                ) : null
              }
            />
          </PanelContent>
        )}
      </Panel>
      {showLoadingOverlay ? (
        <div
          className="absolute inset-0 z-30 grid place-items-center bg-background/75 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          data-testid="editor-loading-overlay"
        >
          <div className="grid place-items-center gap-2 text-center text-sm text-muted-foreground">
            <LoaderCircle className="size-7 animate-spin text-primary" aria-hidden="true" />
            <strong className="text-foreground">
              {preview.status === "loading" && preview.kind === "proxy"
                ? t("preview.preparing")
                : t("preview.opening")}
            </strong>
          </div>
        </div>
      ) : null}
    </PersistedPanelGroup>
  );
}
