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

function createDefaultEditorSnapshot(source: SourceRef, mergeAudio: boolean): EditorSnapshot {
  return createEditorSnapshot({
    source,
    trim: { kind: "full-source" },
    crop: null,
    flipHorizontal: false,
    flipVertical: false,
    rotation: 0,
    audioTracks: [],
    mergeAudio,
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
    audioTracks: state.audio.tracks.map(serializeAudioTrackSettings),
    mergeAudio: state.audio.mergeAudio,
  });
}

export { createDefaultEditorSnapshot, createEditorSnapshotFromState };
