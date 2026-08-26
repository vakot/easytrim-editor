import { useEffect, useRef } from "react";
import { Group, Panel } from "react-resizable-panels";
import { useTranslation } from "react-i18next";
import { LoaderCircle } from "lucide-react";

import { PanelSeparator } from "@/components/PanelSeparator";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  editorStageLayoutChanged,
  panelVisibilityChanged,
  selectEditorStageLayout,
  selectPanelVisibility,
} from "@/app/store/slices/editor-layout-slice";
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
import { selectPreview } from "@/app/store/slices/preview-slice";
import {
  selectSourceMedia,
  selectSourceReady,
  selectSourceSelection,
} from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { prepareSourceWaveforms } from "@/app/store/thunks/source-media-thunks";
import { usePlayback, useTimeline } from "@/app/hooks/useEditorContracts";
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
import { PanelContent } from "@/components/PanelContent";

const EMPTY_TIMELINE_RANGE = {
  startMicros: 0,
  endMicros: 1_000_000,
  sourceDurationMicros: 1_000_000,
} as const;

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
  const editorStageLayout = useAppSelector(selectEditorStageLayout);
  const isBottomPanelVisible = useAppSelector((state) => selectPanelVisibility(state, "bottom"));
  const previousEditorStageLayout = useRef(editorStageLayout);
  const sourcePath = sourceSelection?.sourcePath ?? null;
  const timelineRange = trim ?? EMPTY_TIMELINE_RANGE;
  const controlsDisabled = !isSourceReady || !playback.isReady;
  const showLoadingOverlay =
    sourceSelection !== null && preview.status !== "failed" && !playback.isReady;

  const timelinePanelSizing = useTimelinePanelSizing(
    sourceSelection !== null,
    media?.audioStreams.length ?? null,
    isBottomPanelVisible,
  );

  useEffect(() => {
    if (editorStageLayout === undefined && previousEditorStageLayout.current !== undefined) {
      timelinePanelSizing.resetToDefault();
    }
    previousEditorStageLayout.current = editorStageLayout;
  }, [editorStageLayout, timelinePanelSizing]);

  return (
    <Group
      id="editor-stage-panels"
      defaultLayout={editorStageLayout}
      onLayoutChanged={(layout) => dispatch(editorStageLayoutChanged(layout))}
      orientation="vertical"
      className="relative min-h-0 min-w-0 bg-background"
      resizeTargetMinimumSize={{ fine: 8, coarse: 24 }}
      aria-label={t("preview.panes")}
      aria-busy={showLoadingOverlay}
    >
      <Panel id="preview-panel" minSize="14rem" className="min-h-0 min-w-0">
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
      </Panel>

      <PanelSeparator
        id="preview-timeline-resize-handle"
        label={t("preview.resize")}
        orientation="horizontal"
        collapsed={!isBottomPanelVisible}
        onDoubleClick={timelinePanelSizing.resetToDefault}
      />

      <Panel
        id="timeline-panel"
        panelRef={timelinePanelSizing.panelRef}
        defaultSize={timelinePanelSizing.initialDefaultSize}
        collapsible
        collapsedSize={timelinePanelSizing.collapsedSize}
        minSize={timelinePanelSizing.constraints.minSize}
        maxSize={timelinePanelSizing.constraints.maxSize}
        onResize={(size) => {
          const isCollapsed =
            timelinePanelSizing.panelRef.current?.isCollapsed() ?? size.inPixels <= 0;
          dispatch(panelVisibilityChanged({ panelId: "bottom", visible: !isCollapsed }));
        }}
        groupResizeBehavior="preserve-pixel-size"
        className="min-h-0 min-w-0 pb-1"
      >
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
              isBottomPanelVisible && (media?.audioStreams.length ?? 0) > 0 ? (
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
    </Group>
  );
}
