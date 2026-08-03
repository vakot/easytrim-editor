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
  estimatedFps?: number;
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
}

export interface ExportSettings {
  resolution: { width: number; height: number };
  frameRate: FrameRate | undefined;
  argumentsText: string;
}
