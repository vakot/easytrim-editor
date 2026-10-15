import { type AudioTrackSettings, serializeAudioTrackSettings } from "./audio-processing";
import type { CropRect } from "./crop";
import type { EditorChapter, MediaInfo } from "./media";
import type { RotationDegrees } from "./rotation";
import type { SourceRef } from "./source";
import { createFullTrimRange, type TrimRange } from "./trim";

type EditorSnapshotTrim = { kind: "full-source" } | { endMicros: number; startMicros: number };

interface EditorSnapshot {
  audio: {
    tracks: AudioTrackSettings[];
  };
  chapters?: EditorChapter[];
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
  chapters?: EditorChapter[];
  crop: CropRect | null;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
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
    },
  };
}

function editorChaptersFromMedia(media: MediaInfo): EditorChapter[] {
  return media.chapters.flatMap((chapter, index) => {
    const startMicros = Math.max(0, chapter.startMicros);
    const endMicros = Math.min(media.durationMicros, chapter.endMicros);
    if (endMicros <= startMicros) return [];
    const title = Array.from(chapter.title?.trim() || `Chapter ${index + 1}`)
      .filter((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint > 0x1f && (codePoint < 0x7f || codePoint > 0x9f);
      })
      .join("")
      .slice(0, 256);

    return [
      {
        endMicros,
        id: `source-${chapter.id}`,
        startMicros,
        title: title || `Chapter ${index + 1}`,
      },
    ];
  });
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
