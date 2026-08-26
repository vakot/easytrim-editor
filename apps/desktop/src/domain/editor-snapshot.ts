import type { CropRect } from "./crop";
import type { SourceRef } from "./source";

export interface EditorSnapshot {
  source: SourceRef;
  trim: { startMicros: number; endMicros: number };
  crop: CropRect | null;
  audio: {
    master: { enabled: boolean; volumePercent: number };
    tracks: Array<{ streamIndex: number; enabled: boolean; volumePercent: number }>;
    mergeAudio: boolean;
  };
}
