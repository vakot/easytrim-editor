import { initialAudioState } from "@/app/store/slices/audio-slice";
import {
  selectCrop,
  selectFlipHorizontal,
  selectFlipVertical,
  selectRotationDegrees,
} from "@/app/store/slices/crop-slice";
import { createEditorSnapshot, type EditorSnapshot } from "@/domain/editor-snapshot";
import type { SourceRef } from "@/domain/source";
import type { RootState } from "@/app/store/store";

function createDefaultEditorSnapshot(source: SourceRef, mergeAudio: boolean): EditorSnapshot {
  return createEditorSnapshot({
    source,
    trim: { kind: "full-source" },
    crop: null,
    flipHorizontal: false,
    flipVertical: false,
    rotation: 0,
    masterAudio: {
      enabled: initialAudioState.masterEnabled,
      volumePercent: initialAudioState.masterVolumePercent,
    },
    audioTracks: [],
    mergeAudio,
  });
}

function createEditorSnapshotFromState(state: RootState, source: SourceRef): EditorSnapshot | null {
  const trim = state.trim.value;
  if (!trim) return null;
  return createEditorSnapshot({
    source,
    trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
    crop: selectCrop(state),
    flipHorizontal: selectFlipHorizontal(state),
    flipVertical: selectFlipVertical(state),
    rotation: selectRotationDegrees(state),
    masterAudio: {
      enabled: state.audio.masterEnabled,
      volumePercent: state.audio.masterVolumePercent,
    },
    audioTracks: state.audio.tracks.map(({ enabled, streamIndex, volumePercent }) => ({
      enabled,
      streamIndex,
      volumePercent,
    })),
    mergeAudio: state.audio.mergeAudio,
  });
}

export { createDefaultEditorSnapshot, createEditorSnapshotFromState };
