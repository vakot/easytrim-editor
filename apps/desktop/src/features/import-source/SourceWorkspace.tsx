import { Group, Panel } from "react-resizable-panels";

import type { SessionState } from "../../app/session-state";
import { PaneResizeHandle } from "../../components/PaneResizeHandle";
import type { TrimRange } from "../../domain/trim";
import type { BinaryCapability, FrameRate, MediaInfo } from "../../lib/tauri/media";
import { EditorStage } from "../editor/EditorStage";
import { ExportQueue, type ExportToast } from "../export/ExportPanel";

interface SourceWorkspaceProps {
  session: SessionState;
  isChoosingSource: boolean;
  isSourceDragActive: boolean;
  onChooseSource: () => void;
  onPreviewPlaybackError: (sourceId: string, previewKind: "source" | "proxy") => void;
  onTrimChange: (sourceId: string, trim: TrimRange) => void;
  onPrepareWaveforms: (sourceId: string, streamIndexes: number[], width: number) => void;
  onToggleAudioTrack: (sourceId: string, streamIndex: number) => void;
  onAudioTrackVolumeChange: (sourceId: string, streamIndex: number, volumePercent: number) => void;
  onToggleAudioMaster: (sourceId: string) => void;
  onMasterVolumeChange: (sourceId: string, volumePercent: number) => void;
  onToggleAudioMerge: (sourceId: string) => void;
  onWaveformImageError: (sourceId: string, streamIndex: number) => void;
  audioPreviewUrls: Record<number, string>;
  exportQueue: ExportToast[];
}

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
}: SourceWorkspaceProps) {
  if (!session.source) {
    return (
      <section className="import-landing" aria-labelledby="import-title">
        <div className="import-card">
          <p className="section-label">Start a new cut</p>
          <h2 id="import-title">Open a video</h2>
          <p>Drop a supported video here, or select one from your computer.</p>
          <button
            className="primary-button"
            type="button"
            onClick={onChooseSource}
            disabled={isChoosingSource}
          >
            {isChoosingSource ? "Opening…" : "Select video"}
          </button>
          <p className="supported-formats">
            MP4, MOV, MKV, WebM, AVI, TS, MTS, M2TS, M4V, WMV, FLV
          </p>
        </div>

        {session.lastError ? <SourceError error={session.lastError} /> : null}
        {isSourceDragActive ? <DropOverlay /> : null}
      </section>
    );
  }
  const sourceId = session.source.selection.sourceId;

  return (
    <Group
      id="editor-workspace-panels"
      orientation="horizontal"
      className="editor-workspace"
      resizeTargetMinimumSize={{ fine: 8, coarse: 24 }}
      aria-label="Video editor workspace"
    >
      <Panel
        id="source-details-panel"
        defaultSize="20rem"
        minSize="15rem"
        maxSize="30rem"
        groupResizeBehavior="preserve-pixel-size"
        className="workspace-pane-content"
      >
        <aside className="source-sidebar" aria-labelledby="source-title">
          <div className="source-heading">
            <p className="section-label">Source details</p>
            <h1 id="source-title" title={session.source.selection.displayName}>
              {session.source.selection.displayName}
            </h1>
            {session.status === "loading-source" ? (
              <span className="loading-label" role="status">
                Inspecting…
              </span>
            ) : null}
          </div>

          {session.lastError ? <SourceError error={session.lastError} /> : null}
          {session.status === "ready" && session.source.media ? (
            <MediaDetails media={session.source.media} />
          ) : null}
          <ExportQueue queue={exportQueue} />
        </aside>
      </Panel>

      <PaneResizeHandle
        id="source-details-resize-handle"
        label="Resize source details"
        orientation="vertical"
      />

      <Panel id="editor-content-panel" minSize="44rem" className="workspace-pane-content">
        <div className="editor-stage" aria-label="Video preview and timeline area">
          {session.status === "ready" && session.source.media && session.source.trim ? (
            <>
              <EditorStage
                key={sourceId}
                sourceId={sourceId}
                preview={session.source.preview}
                trim={session.source.trim}
                frameRate={
                  session.source.media.video.averageFrameRate ??
                  session.source.media.video.realFrameRate
                }
                audioStreams={session.source.media.audioStreams}
                audioTracks={session.source.audioTracks}
                masterEnabled={session.source.masterEnabled}
                masterVolumePercent={session.source.masterVolumePercent}
                mergeAudio={session.source.mergeAudio}
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
            </>
          ) : null}
          {isSourceDragActive ? <DropOverlay /> : null}
        </div>
      </Panel>
    </Group>
  );
}

export function CapabilityStatus({ capabilities }: { capabilities: SessionState["capabilities"] }) {
  if (capabilities.status === "checking") {
    return (
      <p className="capability capability-checking" role="status">
        Checking media tools…
      </p>
    );
  }

  if (capabilities.status === "failed") {
    return (
      <p className="capability capability-missing" role="status">
        Media tool check failed
      </p>
    );
  }

  const missing = [
    capabilityError("FFmpeg", capabilities.value.ffmpeg),
    capabilityError("FFprobe", capabilities.value.ffprobe),
  ].filter((value): value is string => value !== null);

  if (missing.length === 0) {
    return (
      <p className="capability capability-ready" role="status">
        Media tools ready
      </p>
    );
  }

  const message = missing.join(" ");
  return (
    <p
      className="capability capability-missing"
      role="status"
      aria-label={`Media tools unavailable. ${message}`}
      title={message}
    >
      Media tools unavailable
    </p>
  );
}

function DropOverlay() {
  return (
    <div className="drop-overlay" role="status" aria-label="Drop video to open" aria-live="polite">
      <div>
        <span className="drop-icon" aria-hidden="true">
          +
        </span>
        <strong>Drop video to open</strong>
        <span>The current edit will be reset.</span>
      </div>
    </div>
  );
}

function SourceError({ error }: { error: NonNullable<SessionState["lastError"]> }) {
  return (
    <div className="error-card" role="alert">
      <strong>Could not load this video</strong>
      <p>{error.message}</p>
      {error.diagnostics ? (
        <details>
          <summary>Technical details</summary>
          <pre>{error.diagnostics}</pre>
        </details>
      ) : null}
    </div>
  );
}

function capabilityError(label: string, capability: BinaryCapability): string | null {
  return capability.available ? null : `${label}: ${capability.error ?? "not available."}`;
}

function MediaDetails({ media }: { media: MediaInfo }) {
  const frameRate = media.video.averageFrameRate ?? media.video.realFrameRate;

  return (
    <div className="media-details">
      <dl className="metadata-list" aria-label="Video metadata">
        <Metadata label="Container" value={media.formatLongName ?? media.formatName} />
        <Metadata label="Duration" value={formatDuration(media.durationMicros)} />
        <Metadata label="Resolution" value={`${media.video.width} × ${media.video.height}`} />
        <Metadata label="Frame rate" value={formatFrameRate(frameRate)} />
        <Metadata label="Video codec" value={media.video.codecName.toUpperCase()} />
        <Metadata label="File size" value={formatBytes(media.sizeBytes)} />
        <Metadata label="Bitrate" value={formatBitrate(media.bitrate)} />
        <Metadata label="Video stream" value={`#${media.video.streamIndex}`} />
        <Metadata label="Audio tracks" value={String(media.audioStreams.length)} />
      </dl>
    </div>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatDuration(micros: number): string {
  const totalSeconds = Math.max(0, Math.floor(micros / 1_000_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, "0")).join(":");
}

function formatFrameRate(frameRate: FrameRate | undefined): string {
  if (!frameRate) {
    return "Unknown";
  }
  const value = frameRate.displayValue ?? frameRate.numerator / frameRate.denominator;
  return `${value.toFixed(value % 1 === 0 ? 0 : 2)} fps`;
}

function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined) {
    return "Unknown";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1_000 && unit < units.length - 1) {
    value /= 1_000;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatBitrate(bitrate: number | undefined): string {
  return bitrate === undefined ? "Unknown" : `${(bitrate / 1_000_000).toFixed(2)} Mbps`;
}
