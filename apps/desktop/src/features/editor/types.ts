import type { AudioTrackState, PreviewState } from "@/app/session-state";
import type { TrimBoundary, TrimRange } from "@/domain/trim";
import type { AudioStream, FrameRate } from "@/lib/tauri/media";

export interface EditorStageProps {
  sourceId: string;
  preview: PreviewState;
  trim: TrimRange;
  frameRate?: FrameRate;
  audioStreams: AudioStream[];
  audioTracks: AudioTrackState[];
  masterEnabled: boolean;
  masterVolumePercent: number;
  mergeAudio: boolean;
  onPreviewPlaybackError: (sourceId: string, previewKind: "source" | "proxy") => void;
  onTrimChange: (trim: TrimRange) => void;
  onPrepareWaveforms: (streamIndexes: number[], width: number) => void;
  onToggleAudioTrack: (streamIndex: number) => void;
  onAudioTrackVolumeChange: (streamIndex: number, volumePercent: number) => void;
  onToggleAudioMaster: () => void;
  onMasterVolumeChange: (volumePercent: number) => void;
  onToggleAudioMerge: () => void;
  onWaveformImageError: (streamIndex: number) => void;
  audioPreviewUrls: Record<number, string>;
  sourceDimensions: { width: number; height: number };
  onCropResolutionChange: (resolution: { width: number; height: number }) => void;
  onCropChange: (crop: { x: number; y: number; width: number; height: number }) => void;
}

export interface EditorShortcutActions {
  enabled: boolean;
  togglePlayback: () => void;
  stepFrame: (direction: -1 | 1) => void;
  setSegmentBoundary: (boundary: TrimBoundary) => void;
}
