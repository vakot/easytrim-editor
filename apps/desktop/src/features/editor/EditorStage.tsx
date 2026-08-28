import { usePlayback, useTimeline } from "@/app/hooks/useEditorContracts";
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
import { selectPreview } from "@/app/store/slices/preview-slice";
import {
  selectSourceMedia,
  selectSourceReady,
  selectSourceSelection,
} from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { prepareSourceWaveforms } from "@/app/store/thunks/source-media-thunks";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { AudioTracks } from "@/features/audio-tracks";
import { TimelinePane } from "@/features/editor/components/TimelinePane";
import { useTimelinePanelSizing } from "@/features/editor/hooks/useTimelinePanelSizing";
import {
  PlaybackControls,
  PlaybackTimecode,
  TimelineTools,
} from "@/features/preview/PlaybackControls";
import { VideoPreview } from "@/features/preview/VideoPreview";
import { TrimTimeline } from "@/features/timeline";
import { LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

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
      <ResizablePanel id="editor-stage-preview" minSize="14rem">
        <div className="rounded-md border border-border h-full overflow-hidden bg-preview-surface">
          <EditorStagePreview />
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
        className="pb-1"
        groupResizeBehavior="preserve-pixel-size"
      >
        <div className="rounded-md border border-border h-full overflow-hidden bg-card/30">
          <EditorStageTimeline />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function EditorStagePreview() {
  const { t } = useTranslation();

  const playback = usePlayback();
  const sourceSelection = useAppSelector(selectSourceSelection);
  const preview = useAppSelector(selectPreview);

  return (
    <>
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
      <EditorStageLoading loading={sourceSelection !== null && preview.status !== "failed"}>
        {preview.status === "loading" && preview.kind === "proxy"
          ? t("preview.preparing")
          : t("preview.opening")}
      </EditorStageLoading>
    </>
  );
}

function EditorStageTimeline() {
  const { t } = useTranslation();

  const sourceSelection = useAppSelector(selectSourceSelection);
  const playback = usePlayback();
  const trim = useAppSelector(selectTrim);
  const timelineRange = trim ?? EMPTY_TIMELINE_RANGE;

  return (
    <>
      <TimelinePane
        range={timelineRange}
        timeline={<EditorStageTrim />}
        audioTracks={<EditorStageAudio />}
      />
      <EditorStageLoading loading={sourceSelection !== null && !playback.isReady}>
        {t("common.loading")}
      </EditorStageLoading>
    </>
  );
}

function EditorStageTrim() {
  const media = useAppSelector(selectSourceMedia);
  const trim = useAppSelector(selectTrim);
  const isSourceReady = useAppSelector(selectSourceReady);
  const playback = usePlayback();
  const timeline = useTimeline();
  const timelineRange = trim ?? EMPTY_TIMELINE_RANGE;
  const controlsDisabled = !isSourceReady || !playback.isReady;

  return (
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
          sourceDurationMicros={controlsDisabled ? null : timelineRange.sourceDurationMicros}
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
  );
}

function EditorStageAudio() {
  const sourceSelection = useAppSelector(selectSourceSelection);
  const media = useAppSelector(selectSourceMedia);
  const trim = useAppSelector(selectTrim);
  const audioTracks = useAppSelector(selectAudioTracks);
  const mergeAudio = useAppSelector(selectMergeAudio);
  const masterAudio = useAppSelector(selectMasterAudio);
  const playback = usePlayback();
  const timeline = useTimeline();
  const dispatch = useAppDispatch();
  const sourcePath = sourceSelection?.sourcePath ?? null;
  const timelineRange = trim ?? EMPTY_TIMELINE_RANGE;

  if (!media?.audioStreams.length) return null;

  return (
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
      onMasterVolumeChange={(volumePercent) => dispatch(masterVolumeChanged({ volumePercent }))}
      onToggleMerge={() => dispatch(audioMergeToggled())}
      onPrepareWaveforms={(streamIndexes, width) =>
        sourcePath && void dispatch(prepareSourceWaveforms(sourcePath, streamIndexes, width))
      }
      onWaveformImageError={(streamIndex) => dispatch(waveformDisplayFailed({ streamIndex }))}
    />
  );
}

function EditorStageLoading({ loading, children }: React.PropsWithChildren<{ loading: boolean }>) {
  if (!loading) return null;

  return (
    <div
      className="absolute inset-0 z-30 grid place-items-center bg-background/75 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      data-testid="editor-loading-overlay"
    >
      <div className="grid place-items-center gap-2 text-center text-sm text-muted-foreground">
        <LoaderCircle className="size-7 animate-spin text-primary" aria-hidden="true" />
        <strong className="text-foreground">{children}</strong>
      </div>
    </div>
  );
}
