import { type AudioTrackSettings, serializeAudioTrackSettings } from "./audio-processing";
import type { CropRect } from "./crop";
import type { EditorChapter, MediaInfo } from "./media";
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
  chapters?: EditorChapter[];
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
  chapters?: EditorChapter[];
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
    ...(input.chapters === undefined
      ? {}
      : { chapters: input.chapters.map((chapter) => ({ ...chapter })) }),
    flipHorizontal: input.flipHorizontal ?? false,
    flipVertical: input.flipVertical ?? false,
    rotation: input.rotation ?? 0,
    ...(input.sceneBoundariesMicros === undefined
      ? {}
      : { sceneBoundariesMicros: [...input.sceneBoundariesMicros] }),
    audio: {
      tracks: input.audioTracks.map(serializeAudioTrackSettings),
      mergeAudio: input.mergeAudio,
    },
  };
}

function editorChaptersFromMedia(media: MediaInfo): EditorChapter[] {
  return media.chapters.map((chapter, index) => ({
    endMicros: chapter.endMicros,
    id: `source-${chapter.id}`,
    startMicros: chapter.startMicros,
    title: chapter.title?.trim() || `Chapter ${index + 1}`,
  }));
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

export { createEditorSnapshot, editorChaptersFromMedia, resolveEditorSnapshotTrim };

export type { EditorSnapshot };
