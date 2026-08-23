import type { SessionState } from "@/app/session-state";
import type { TrimRange } from "@/domain/trim";
import type { ExportToast } from "@/features/export";

export interface SourceWorkspaceProps {
  session: SessionState;
  isSourceDragActive: boolean;
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
  onCropResolutionChange: (resolution: { width: number; height: number }) => void;
  onCropChange: (crop: { x: number; y: number; width: number; height: number }) => void;
}
