import type { CropRect } from "./crop";
import type { RotationDegrees } from "./rotation";
import type { SourceRef } from "./source";
import { createFullTrimRange, type TrimRange } from "./trim";

type EditorSnapshotTrim = { kind: "full-source" } | { endMicros: number; startMicros: number };

export interface EditorSnapshot {
  audio: {
    master: { enabled: boolean; volumePercent: number };
    mergeAudio: boolean;
    tracks: Array<{ enabled: boolean; streamIndex: number; volumePercent: number }>;
  };
  crop: CropRect | null;
  rotation?: RotationDegrees;
  source: SourceRef;
  trim: EditorSnapshotTrim;
}

export function createEditorSnapshot(input: {
  audioTracks: EditorSnapshot["audio"]["tracks"];
  crop: CropRect | null;
  masterAudio: EditorSnapshot["audio"]["master"];
  mergeAudio: boolean;
  rotation?: RotationDegrees;
  source: SourceRef;
  trim: EditorSnapshot["trim"];
}): EditorSnapshot {
  return {
    source: { ...input.source },
    trim: "kind" in input.trim ? { kind: input.trim.kind } : { ...input.trim },
    crop: input.crop ? { ...input.crop } : null,
    rotation: input.rotation ?? 0,
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
