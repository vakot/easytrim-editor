import type { CropRect } from "./crop";

export interface EditorSnapshot {
  sourcePath: string;
  trim: { startMicros: number; endMicros: number };
  crop: CropRect | null;
  audio: {
    master: { enabled: boolean; volumePercent: number };
    tracks: Array<{ streamIndex: number; enabled: boolean; volumePercent: number }>;
    mergeAudio: boolean;
  };
}
