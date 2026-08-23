import { useEffect } from "react";
import { Group, Panel, usePanelRef } from "react-resizable-panels";

import { PaneResizeHandle } from "@/components/PaneResizeHandle";
import { EditorStage } from "@/features/editor";
import { DropOverlay } from "./components/DropOverlay";
import { SourceSidebar } from "./components/SourceSidebar";
import type { SourceWorkspaceProps } from "./types";
import { useTranslation } from "react-i18next";
import { useEditorViewState } from "@/app/hooks/useEditorViewState";

export { CapabilityStatus } from "./components/CapabilityStatus";

export function SourceWorkspace({
  session,
  isSourceDragActive,
  onPreviewPlaybackError,
  onTrimChange,
  onPrepareWaveforms,
  onToggleAudioTrack,
  onAudioTrackVolumeChange,
  onToggleAudioMaster,
  onMasterVolumeChange,
  onToggleAudioMerge,
  onWaveformImageError,
  audioPreviewUrls,
  exportQueue,
  onCropResolutionChange,
  onCropChange,
}: SourceWorkspaceProps) {
  const { t } = useTranslation();
  const { showSourceDetails, setShowSourceDetails, workspaceLayout, setWorkspaceLayout } =
    useEditorViewState();
  const sourceDetailsPanelRef = usePanelRef();

  useEffect(() => {
    const panel = sourceDetailsPanelRef.current;
    if (!panel) return;

    if (showSourceDetails) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [showSourceDetails, sourceDetailsPanelRef]);

  if (!session.source) {
    return (
      <div
        className={`grid h-full min-h-0 min-w-0 overflow-hidden bg-background ${
          showSourceDetails ? "grid-cols-[20rem_minmax(0,1fr)]" : "grid-cols-[0_minmax(0,1fr)]"
        }`}
        aria-label={t("import.source.workspace")}
      >
        <div className="min-w-0 overflow-hidden bg-card/30">
          <SourceSidebar session={session} queue={exportQueue} />
        </div>
        <div
          className="relative min-h-0 min-w-0 overflow-hidden"
          aria-label={t("import.source.previewArea")}
        >
          <EditorStage source={null} />
          {isSourceDragActive ? <DropOverlay /> : null}
        </div>
      </div>
    );
  }

  const source = session.source;
  const editorSource =
    source && session.status === "ready" && source.media && source.trim
      ? {
          sourceId: source.selection.sourceId,
          preview: source.preview,
          trim: source.trim,
          frameRate: source.media.video.averageFrameRate ?? source.media.video.realFrameRate,
          audioStreams: source.media.audioStreams,
          audioTracks: source.audioTracks,
          masterEnabled: source.masterEnabled,
          masterVolumePercent: source.masterVolumePercent,
          mergeAudio: source.mergeAudio,
          onPreviewPlaybackError,
          onTrimChange: (trim: Parameters<typeof onTrimChange>[1]) =>
            onTrimChange(source.selection.sourceId, trim),
          onPrepareWaveforms: (streamIndexes: number[], width: number) =>
            onPrepareWaveforms(source.selection.sourceId, streamIndexes, width),
          onToggleAudioTrack: (streamIndex: number) =>
            onToggleAudioTrack(source.selection.sourceId, streamIndex),
          onAudioTrackVolumeChange: (streamIndex: number, volumePercent: number) =>
            onAudioTrackVolumeChange(source.selection.sourceId, streamIndex, volumePercent),
          onToggleAudioMaster: () => onToggleAudioMaster(source.selection.sourceId),
          onMasterVolumeChange: (volumePercent: number) =>
            onMasterVolumeChange(source.selection.sourceId, volumePercent),
          onToggleAudioMerge: () => onToggleAudioMerge(source.selection.sourceId),
          onWaveformImageError: (streamIndex: number) =>
            onWaveformImageError(source.selection.sourceId, streamIndex),
          audioPreviewUrls,
          sourceDimensions: {
            width: source.media.video.width,
            height: source.media.video.height,
          },
          onCropResolutionChange,
          onCropChange,
        }
      : null;

  return (
    <Group
      id="editor-workspace-panels"
      defaultLayout={workspaceLayout}
      onLayoutChanged={setWorkspaceLayout}
      orientation="horizontal"
      className="min-h-0 min-w-0 bg-background"
      resizeTargetMinimumSize={{ fine: 8, coarse: 24 }}
      aria-label={t("import.source.workspace")}
    >
      <Panel
        id="source-details-panel"
        panelRef={sourceDetailsPanelRef}
        collapsible
        collapsedSize={0}
        defaultSize="20rem"
        minSize="15rem"
        maxSize="30rem"
        onResize={(size) => {
          const isCollapsed = sourceDetailsPanelRef.current?.isCollapsed() ?? size.inPixels <= 0;
          setShowSourceDetails(!isCollapsed);
        }}
        groupResizeBehavior="preserve-pixel-size"
        className="min-h-0 min-w-0 overflow-hidden bg-card/30"
      >
        <SourceSidebar session={session} queue={exportQueue} />
      </Panel>

      <PaneResizeHandle
        id="source-details-resize-handle"
        label={t("import.source.resizeDetails")}
        orientation="vertical"
      />

      <Panel id="editor-content-panel" minSize="44rem" className="min-h-0 min-w-0 overflow-hidden">
        <div
          className="relative h-full min-h-0 min-w-0"
          aria-label={t("import.source.previewArea")}
        >
          {editorSource ? <EditorStage key={editorSource.sourceId} source={editorSource} /> : null}
          {isSourceDragActive ? <DropOverlay /> : null}
        </div>
      </Panel>
    </Group>
  );
}
