import type { RefObject } from "react";

import type { AudioTrackState } from "@/app/session-state";
import type { TrimRange } from "@/domain/trim";
import type { AudioStream } from "@/lib/tauri/media";

export interface AudioTracksProps {
  streams: AudioStream[];
  tracks: AudioTrackState[];
  masterEnabled: boolean;
  masterVolumePercent: number;
  range: TrimRange;
  playheadMicros: number;
  playheadRef: RefObject<HTMLDivElement | null>;
  mergeAudio: boolean;
  waveformPreparationEnabled: boolean;
  onToggleTrack: (streamIndex: number) => void;
  onTrackVolumeChange: (streamIndex: number, volumePercent: number) => void;
  onToggleMaster: () => void;
  onMasterVolumeChange: (volumePercent: number) => void;
  onToggleMerge: () => void;
  onPrepareWaveforms: (streamIndexes: number[], width: number) => void;
  onWaveformImageError: (streamIndex: number) => void;
}
