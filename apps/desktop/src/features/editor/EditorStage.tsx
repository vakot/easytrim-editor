import { Group, Panel } from "react-resizable-panels";
import { useTranslation } from "react-i18next";

import { PaneResizeHandle } from "@/components/PaneResizeHandle";
import { useEditorViewState } from "@/app/hooks/useEditorViewState";
import { usePlayback, useSourceDetails, useTimeline, useTimelineTools } from "@/app/hooks/useEditorContracts";
import { AudioTracks } from "@/features/audio-tracks";
import { PlaybackControls, PlaybackTimecode, TimelineTools } from "@/features/preview/PlaybackControls";
import { VideoPreview } from "@/features/preview/VideoPreview";
import { TrimTimeline } from "@/features/timeline";
import { TimelinePane } from "./components/TimelinePane";
import { useTimelinePanelSizing } from "./hooks/useTimelinePanelSizing";

export function EditorStage() {
  const { t } = useTranslation();
  const source = useSourceDetails();
  const playback = usePlayback();
  const timeline = useTimeline();
  const tools = useTimelineTools();
  const { editorStageLayout, setEditorStageLayout, showAudioTracks, setShowAudioTracks } =
    useEditorViewState();

  const timelinePanelSizing = useTimelinePanelSizing(
    source.sourceId ?? "no-source",
    source.audioStreams.length,
    showAudioTracks,
  );

  if (!source.sourceId || !source.media || !source.trim || !source.sourceDimensions) return null;

  return (
    <Group
      id="editor-stage-panels"
      defaultLayout={editorStageLayout}
      onLayoutChanged={setEditorStageLayout}
      orientation="vertical"
      className="min-h-0 min-w-0 bg-background"
      resizeTargetMinimumSize={{ fine: 8, coarse: 24 }}
      aria-label={t("preview.panes")}
    >
      <Panel id="preview-panel" minSize="14rem" className="min-h-0 min-w-0">
        <div className="grid size-full min-h-0 place-items-center overflow-auto bg-preview-surface p-4">
          <VideoPreview
            sourceId={source.sourceId}
            preview={source.preview}
            playbackRate={playback.playbackRate}
            muted={Object.keys(source.audioPreviewUrls).length > 0}
            videoRef={playback.videoRef}
            onPlaybackError={(_, previewKind) => playback.onPreviewPlaybackError(previewKind)}
            onLoadedMetadata={playback.onLoadedMetadata}
            onTogglePlayback={playback.toggle}
            onPlay={playback.onPlay}
            onPause={playback.onPause}
            onTimeUpdate={playback.onTimeUpdate}
            onEnded={playback.onEnded}
            sourceDimensions={source.sourceDimensions}
            onCropResolutionChange={source.onCropResolutionChange}
            onCropChange={source.onCropChange}
            onCropToolOpenChange={playback.onCropToolOpenChange}
          />
        </div>
      </Panel>

      <PaneResizeHandle
        id="preview-timeline-resize-handle"
        label={t("preview.resize")}
        orientation="horizontal"
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
          setShowAudioTracks(!isCollapsed);
        }}
        groupResizeBehavior="preserve-pixel-size"
        className="min-h-0 min-w-0 bg-background"
      >
        <TimelinePane
          range={source.trim}
          timeline={
            <TrimTimeline
              range={source.trim}
              playheadMicros={timeline.playheadMicros}
              playheadRef={timeline.playheadRef}
              frameRate={source.frameRate}
              playbackControls={
                source.preview.status === "ready" ? (
                  <PlaybackControls
                    isPlaying={playback.isPlaying}
                    error={playback.transportError}
                    canSetSegmentStart={timeline.canSetSegmentStart}
                    canSetSegmentEnd={timeline.canSetSegmentEnd}
                    onTogglePlayback={playback.toggle}
                    onStepFrame={playback.stepFrame}
                    onSetSegmentBoundary={playback.setSegmentBoundary}
                  />
                ) : null
              }
              playbackTimecode={
                source.preview.status === "ready" ? (
                  <PlaybackTimecode
                    currentMicros={timeline.playheadMicros}
                    sourceDurationMicros={source.trim.sourceDurationMicros}
                    frameRate={source.frameRate}
                  />
                ) : null
              }
              videoToolbar={
                source.preview.status === "ready" ? (
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
                ) : null
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
            showAudioTracks && source.audioStreams.length > 0 ? (
              <AudioTracks
                streams={source.audioStreams}
                tracks={source.audioTracks}
                masterEnabled={source.masterEnabled}
                masterVolumePercent={source.masterVolumePercent}
                range={source.trim}
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
      </Panel>
    </Group>
  );
}
