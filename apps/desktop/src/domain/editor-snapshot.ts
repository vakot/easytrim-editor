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

export function createEditorSnapshot(input: {
  source: SourceRef;
  trim: EditorSnapshot["trim"];
  crop: CropRect | null;
  masterAudio: EditorSnapshot["audio"]["master"];
  audioTracks: EditorSnapshot["audio"]["tracks"];
  mergeAudio: boolean;
}): EditorSnapshot {
  return {
    source: { ...input.source },
    trim: { ...input.trim },
    crop: input.crop ? { ...input.crop } : null,
    audio: {
      master: { ...input.masterAudio },
      tracks: input.audioTracks.map((track) => ({ ...track })),
      mergeAudio: input.mergeAudio,
    },
  };
}

export function cloneEditorSnapshot(snapshot: EditorSnapshot): EditorSnapshot {
  return createEditorSnapshot({
    source: snapshot.source,
    trim: snapshot.trim,
    crop: snapshot.crop,
    masterAudio: snapshot.audio.master,
    audioTracks: snapshot.audio.tracks,
    mergeAudio: snapshot.audio.mergeAudio,
  });
}
