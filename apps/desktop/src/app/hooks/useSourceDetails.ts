import { useEditorSession } from "@/app/hooks/useEditorSession";
import type { TrimRange } from "@/domain/trim";

export function useSourceDetails() {
  const app = useEditorSession();
  const source = app.session.source;
  const sourceId = source?.selection.sourceId ?? null;

  return {
    source,
    hasSource: source !== null,
    sourceId,
    sourceName: source?.selection.displayName ?? null,
    media: source?.media ?? null,
    preview: source?.preview ?? { status: "idle" as const },
    trim: source?.trim ?? null,
    audioStreams: source?.media?.audioStreams ?? [],
    audioTracks: source?.audioTracks ?? [],
    audioPreviewUrls: app.audioPreviewUrls,
    masterEnabled: source?.masterEnabled ?? true,
    masterVolumePercent: source?.masterVolumePercent ?? 50,
    mergeAudio: source?.mergeAudio ?? false,
    sourceDimensions: source?.media
      ? { width: source.media.video.width, height: source.media.video.height }
      : null,
    frameRate: source?.media?.video.averageFrameRate ?? source?.media?.video.realFrameRate,
    cropResolution: app.cropResolution,
    crop: app.crop,
    isReady: app.session.status === "ready" && Boolean(source?.media && source.trim),
    onPreviewPlaybackError: (previewKind: "source" | "proxy") => {
      if (sourceId) app.handlePreviewPlaybackError(sourceId, previewKind);
    },
    onTrimChange: (trim: TrimRange) => {
      if (sourceId) app.handleTrimChange(sourceId, trim);
    },
    onPrepareWaveforms: (streamIndexes: number[], width: number) => {
      if (sourceId) app.handlePrepareWaveforms(sourceId, streamIndexes, width);
    },
    onToggleAudioTrack: (streamIndex: number) => {
      if (sourceId) app.handleToggleAudioTrack(sourceId, streamIndex);
    },
    onAudioTrackVolumeChange: (streamIndex: number, volumePercent: number) => {
      if (sourceId) app.handleAudioTrackVolumeChange(sourceId, streamIndex, volumePercent);
    },
    onToggleAudioMaster: () => {
      if (sourceId) app.handleToggleAudioMaster(sourceId);
    },
    onMasterVolumeChange: (volumePercent: number) => {
      if (sourceId) app.handleMasterVolumeChange(sourceId, volumePercent);
    },
    onToggleAudioMerge: () => {
      if (sourceId) app.handleToggleAudioMerge(sourceId);
    },
    onWaveformImageError: (streamIndex: number) => {
      if (sourceId) app.handleWaveformImageError(sourceId, streamIndex);
    },
    onCropResolutionChange: app.setCropResolution,
    onCropChange: app.setCrop,
  };
}
