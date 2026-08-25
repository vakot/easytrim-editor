import type { Dispatch, SetStateAction } from "react";

import type { AudioTrackState } from "@/app/session-state";
import type { ExportPresetAction, ExportPresetState } from "./export-presets";
import type { TrimRange } from "@/domain/trim";
import type { FrameRate, MediaInfo } from "@/lib/tauri/media";

export type ExportStatus = "queued" | "rendering" | "completed" | "failed" | "canceled";

export interface ExportToast {
  id: string;
  operationId: string | null;
  filename: string;
  path: string;
  status: ExportStatus;
  startedAt: number | null;
  durationMs: number | null;
  progressPercent?: number;
  currentFrame?: number;
  totalFrames?: number;
  fps?: number;
  bitrate?: string;
  fileSizeBytes?: number;
  estimatedFileSizeBytes?: number;
  estimatedElapsedTimeMs?: number;
  estimatedTotalTimeMs?: number;
  error?: string;
  onCancel?: () => void;
}

export interface ExportPanelProps {
  source: MediaInfo;
  sourceName: string;
  trim: TrimRange;
  audioTracks: AudioTrackState[];
  masterEnabled: boolean;
  masterVolumePercent: number;
  mergeAudio: boolean;
  setQueue: Dispatch<SetStateAction<ExportToast[]>>;
  presetState: ExportPresetState;
  onPresetAction: Dispatch<ExportPresetAction>;
  onNativeDialogStateChange: (open: boolean) => void;
  cropResolution: { width: number; height: number };
  crop?: { x: number; y: number; width: number; height: number };
}

export interface ExportPanelHandle {
  startFastCut: () => void;
  openOptimizedDialog: () => void;
}

export interface ExportSettings {
  resolution: { width: number; height: number };
  frameRate: FrameRate | undefined;
  argumentsText: string;
}
