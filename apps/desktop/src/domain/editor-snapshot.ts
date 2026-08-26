import type { CropRect } from "./crop";
import { createFullTrimRange, type TrimRange } from "./trim";
import type { SourceRef } from "./source";

export type EditorSnapshotTrim =
  { kind: "full-source" } | { startMicros: number; endMicros: number };

export interface EditorSnapshot {
  source: SourceRef;
  trim: EditorSnapshotTrim;
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
    trim: "kind" in input.trim ? { kind: input.trim.kind } : { ...input.trim },
    crop: input.crop ? { ...input.crop } : null,
    audio: {
      master: { ...input.masterAudio },
      tracks: input.audioTracks.map((track) => ({ ...track })),
      mergeAudio: input.mergeAudio,
    },
  };
}

export function resolveEditorSnapshotTrim(
  trim: EditorSnapshotTrim,
  sourceDurationMicros: number,
): TrimRange {
  if ("kind" in trim) {
    return createFullTrimRange(sourceDurationMicros);
  }

  return { ...trim, sourceDurationMicros };
}

export function editorSnapshotTrimStart(trim: EditorSnapshotTrim): number {
  return "kind" in trim ? 0 : trim.startMicros;
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
