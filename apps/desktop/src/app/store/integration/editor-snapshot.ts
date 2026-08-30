import { initialAudioState } from "@/app/store/slices/audio-slice";
import { createEditorSnapshot, type EditorSnapshot } from "@/domain/editor-snapshot";
import type { SourceRef } from "@/domain/source";

export function createDefaultEditorSnapshot(
  source: SourceRef,
  mergeAudio: boolean,
): EditorSnapshot {
  return createEditorSnapshot({
    source,
    trim: { kind: "full-source" },
    crop: null,
    masterAudio: {
      enabled: initialAudioState.masterEnabled,
      volumePercent: initialAudioState.masterVolumePercent,
    },
    audioTracks: [],
    mergeAudio,
  });
}
