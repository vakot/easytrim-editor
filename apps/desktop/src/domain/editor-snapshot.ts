import type { AudioTrackSettings } from "./audio-processing";
import type { CropRect } from "./crop";
import type { RotationDegrees } from "./rotation";
import type { SourceRef } from "./source";
import { createFullTrimRange, type TrimRange } from "./trim";

type EditorSnapshotTrim = { kind: "full-source" } | { endMicros: number; startMicros: number };

interface EditorSnapshot {
  audio: {
    mergeAudio: boolean;
    tracks: AudioTrackSettings[];
  };
  crop: CropRect | null;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  rotation?: RotationDegrees;
  sceneBoundariesMicros?: number[];
  source: SourceRef;
  trim: EditorSnapshotTrim;
}

function createEditorSnapshot(input: {
  audioTracks: EditorSnapshot["audio"]["tracks"];
  crop: CropRect | null;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  mergeAudio: boolean;
  rotation?: RotationDegrees;
  sceneBoundariesMicros?: number[];
  source: SourceRef;
  trim: EditorSnapshot["trim"];
}): EditorSnapshot {
  return {
    source: { ...input.source },
    trim: "kind" in input.trim ? { kind: input.trim.kind } : { ...input.trim },
    crop: input.crop ? { ...input.crop } : null,
    flipHorizontal: input.flipHorizontal ?? false,
    flipVertical: input.flipVertical ?? false,
    rotation: input.rotation ?? 0,
    ...(input.sceneBoundariesMicros === undefined
      ? {}
      : { sceneBoundariesMicros: [...input.sceneBoundariesMicros] }),
    audio: {
      tracks: input.audioTracks.map((track) => ({
        ...track,
        processing: { ...track.processing },
      })),
      mergeAudio: input.mergeAudio,
    },
  };
}

function resolveEditorSnapshotTrim(
  trim: EditorSnapshotTrim,
  sourceDurationMicros: number,
): TrimRange {
  if ("kind" in trim) {
    return createFullTrimRange(sourceDurationMicros);
  }

  return { ...trim, sourceDurationMicros };
}

export { createEditorSnapshot, resolveEditorSnapshotTrim };

export type { EditorSnapshot };
