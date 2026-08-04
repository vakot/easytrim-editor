import { Group, Panel } from "react-resizable-panels";

import { PaneResizeHandle } from "@/components/PaneResizeHandle";
import { EditorStage } from "@/features/editor";
import { DropOverlay } from "./components/DropOverlay";
import { SourceSidebar } from "./components/SourceSidebar";
import { WelcomePage } from "./components/WelcomePage";
import type { SourceWorkspaceProps } from "./types";
import { useTranslation } from "react-i18next";
import { useEditorViewState } from "@/app/hooks/useEditorViewState";

export { CapabilityStatus } from "./components/CapabilityStatus";

export function SourceWorkspace({
  session,
  isChoosingSource,
  isSourceDragActive,
  onChooseSource,
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
  update,
}: SourceWorkspaceProps) {
  const { t } = useTranslation();
  const { workspaceLayout, setWorkspaceLayout } = useEditorViewState();

  if (!session.source) {
    return (
      <WelcomePage
        session={session}
        isChoosingSource={isChoosingSource}
        isSourceDragActive={isSourceDragActive}
        onChooseSource={onChooseSource}
        update={update}
      />
    );
  }

  const source = session.source;
  const sourceId = source.selection.sourceId;
  const media = source.media;
  const trimRange = source.trim;

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
        defaultSize="20rem"
        minSize="15rem"
        maxSize="30rem"
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
          {session.status === "ready" && media && trimRange ? (
            <EditorStage
              key={sourceId}
              sourceId={sourceId}
              preview={source.preview}
              trim={trimRange}
              frameRate={media.video.averageFrameRate ?? media.video.realFrameRate}
              audioStreams={media.audioStreams}
              audioTracks={source.audioTracks}
              masterEnabled={source.masterEnabled}
              masterVolumePercent={source.masterVolumePercent}
              mergeAudio={source.mergeAudio}
              onPreviewPlaybackError={onPreviewPlaybackError}
              onTrimChange={(trim) => onTrimChange(sourceId, trim)}
              onPrepareWaveforms={(streamIndexes, width) =>
                onPrepareWaveforms(sourceId, streamIndexes, width)
              }
              onToggleAudioTrack={(streamIndex) => onToggleAudioTrack(sourceId, streamIndex)}
              onAudioTrackVolumeChange={(streamIndex, volumePercent) =>
                onAudioTrackVolumeChange(sourceId, streamIndex, volumePercent)
              }
              onToggleAudioMaster={() => onToggleAudioMaster(sourceId)}
              onMasterVolumeChange={(volumePercent) =>
                onMasterVolumeChange(sourceId, volumePercent)
              }
              onToggleAudioMerge={() => onToggleAudioMerge(sourceId)}
              onWaveformImageError={(streamIndex) => onWaveformImageError(sourceId, streamIndex)}
              audioPreviewUrls={audioPreviewUrls}
            />
          ) : null}
          {isSourceDragActive ? <DropOverlay /> : null}
        </div>
      </Panel>
    </Group>
  );
}
