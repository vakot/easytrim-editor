import { Group, Panel } from "react-resizable-panels";
import { useTranslation } from "react-i18next";
import { LoaderCircle } from "lucide-react";

import { PanelSeparator } from "@/components/PanelSeparator";
import { useEditorViewState } from "@/app/hooks/useEditorViewState";
import {
  usePlayback,
  useSourceDetails,
  useTimeline,
  useTimelineTools,
} from "@/app/hooks/useEditorContracts";
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
  const source = useSourceDetails();
  const playback = usePlayback();
  const timeline = useTimeline();
  const tools = useTimelineTools();
  const { editorStageLayout, setEditorStageLayout, showTimeline, setShowTimeline } =
    useEditorViewState();
  const timelineRange = source.trim ?? EMPTY_TIMELINE_RANGE;
  const controlsDisabled = !source.isReady || !playback.isReady;
  const showLoadingOverlay =
    source.hasSource && source.preview.status !== "failed" && !playback.isReady;

  const timelinePanelSizing = useTimelinePanelSizing(
    source.sourceId ?? "no-source",
    source.audioStreams.length,
    showTimeline,
  );

  return (
    <Group
      id="editor-stage-panels"
      defaultLayout={editorStageLayout}
      onLayoutChanged={setEditorStageLayout}
      orientation="vertical"
      className="relative min-h-0 min-w-0 bg-background"
      resizeTargetMinimumSize={{ fine: 8, coarse: 24 }}
      aria-label={t("preview.panes")}
      aria-busy={showLoadingOverlay}
    >
      <Panel id="preview-panel" minSize="14rem" className="min-h-0 min-w-0">
        <PanelContent className="bg-preview-surface">
          <VideoPreview
            sourceId={source.sourceId}
            preview={source.preview}
            playbackRate={playback.playbackRate}
            nativeLoopEnabled={playback.nativeLoopEnabled}
            muted={playback.videoMuted}
            videoRef={playback.videoRef}
            onPlaybackError={(_, previewKind) => playback.onPreviewPlaybackError(previewKind)}
            onLoadedMetadata={playback.onLoadedMetadata}
            onCanPlay={playback.onCanPlay}
            onTogglePlayback={playback.toggle}
            onPlay={playback.onPlay}
            onPause={playback.onPause}
            onTimeUpdate={playback.onTimeUpdate}
            onEnded={playback.onEnded}
            sourceDimensions={source.sourceDimensions ?? undefined}
            onCropResolutionChange={source.onCropResolutionChange}
            onCropChange={source.onCropChange}
            onCropToolOpenChange={playback.onCropToolOpenChange}
          />
        </PanelContent>
      </Panel>

      <PanelSeparator
        id="preview-timeline-resize-handle"
        label={t("preview.resize")}
        orientation="horizontal"
        collapsed={!showTimeline}
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
          setShowTimeline(!isCollapsed);
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
                frameRate={source.frameRate}
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
                    frameRate={source.frameRate}
                  />
                }
                videoToolbar={
                  <TimelineTools
                    safeTrimFollowingEnabled={tools.safeTrimFollowingEnabled}
                    loopPlaybackEnabled={tools.loopPlaybackEnabled}
                    segmentPlaybackEnabled={tools.segmentPlaybackEnabled}
                    playbackSpeed={tools.playbackSpeed}
                    onToggleSafeTrimFollowing={tools.toggleSafeTrimFollowing}
                    onToggleLoopPlayback={tools.toggleLoopPlayback}
                    onToggleSegmentPlayback={tools.toggleSegmentPlayback}
                    onPlaybackSpeedChange={tools.setPlaybackSpeed}
                    onReset={tools.reset}
                  />
                }
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
              showTimeline && source.audioStreams.length > 0 ? (
                <AudioTracks
                  streams={source.audioStreams}
                  tracks={source.audioTracks}
                  masterEnabled={source.masterEnabled}
                  masterVolumePercent={source.masterVolumePercent}
                  range={timelineRange}
                  playheadMicros={timeline.playheadMicros}
                  playheadRef={playback.audioPlayheadRef}
                  mergeAudio={source.mergeAudio}
                  onToggleTrack={source.onToggleAudioTrack}
                  onTrackVolumeChange={source.onAudioTrackVolumeChange}
                  onToggleMaster={source.onToggleAudioMaster}
                  onMasterVolumeChange={source.onMasterVolumeChange}
                  onToggleMerge={source.onToggleAudioMerge}
                  onPrepareWaveforms={source.onPrepareWaveforms}
                  onWaveformImageError={source.onWaveformImageError}
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
              {source.preview.status === "loading" && source.preview.kind === "proxy"
                ? t("preview.preparing")
                : t("preview.opening")}
            </strong>
          </div>
        </div>
      ) : null}
    </Group>
  );
}
