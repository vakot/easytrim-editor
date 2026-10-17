import { selectChapters } from "@/app/store/slices/chapters-slice";
import {
  selectCrop,
  selectFlipHorizontal,
  selectFlipVertical,
  selectRotationDegrees,
} from "@/app/store/slices/crop-slice";
import { selectActiveEditingInstance } from "@/app/store/slices/editing-instances-slice";
import type { RootState } from "@/app/store/store";
import { serializeAudioTrackSettings } from "@/domain/audio-processing";
import { createEditorSnapshot, type EditorSnapshot } from "@/domain/editor-snapshot";
import { normalizeSourceKey, type SourceRef } from "@/domain/source";
import type { HistoryValue } from "@/domain/workspace-history";

function createDefaultEditorSnapshot(source: SourceRef): EditorSnapshot {
  return createEditorSnapshot({
    source,
    trim: { kind: "full-source" },
    crop: null,
    flipHorizontal: false,
    flipVertical: false,
    rotation: 0,
    audioTracks: [],
  });
}

function createEditorSnapshotFromState(state: RootState, source: SourceRef): EditorSnapshot | null {
  const trim = state.trim.value;
  if (!trim) return null;
  const activeSnapshot = selectActiveEditingInstance(state)?.snapshot;
  const sceneBoundariesMicros =
    activeSnapshot &&
    normalizeSourceKey(activeSnapshot.source.sourcePath) === normalizeSourceKey(source.sourcePath)
      ? activeSnapshot.sceneBoundariesMicros
      : undefined;

  return createEditorSnapshot({
    source,
    trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
    crop: selectCrop(state),
    flipHorizontal: selectFlipHorizontal(state),
    flipVertical: selectFlipVertical(state),
    rotation: selectRotationDegrees(state),
    sceneBoundariesMicros,
    chapters: selectChapters(state),
    audioTracks: state.audio.tracks.map(serializeAudioTrackSettings),
  });
}

function historyProjection(snapshot: EditorSnapshot): Record<string, HistoryValue> {
  return {
    crop: snapshot.crop,
    flipHorizontal: snapshot.flipHorizontal ?? false,
    flipVertical: snapshot.flipVertical ?? false,
    rotation: snapshot.rotation ?? 0,
    trim: snapshot.trim,
    ...Object.fromEntries(
      snapshot.audio.tracks.map((track) => [`audio:${track.streamIndex}`, track]),
    ),
    ...Object.fromEntries(
      (snapshot.chapters ?? []).map((chapter) => [`chapter:${chapter.id}`, chapter]),
    ),
  } as Record<string, HistoryValue>;
}

export { createDefaultEditorSnapshot, createEditorSnapshotFromState, historyProjection };
