import {
  audioMergeToggled,
  audioTrackToggled,
  audioTrackVolumeChanged,
  initialAudioState,
  masterAudioToggled,
  masterVolumeChanged,
  selectAudioTracks,
  selectMasterAudio,
  selectMergeAudio,
} from "@/app/store/slices/audio-slice";
import { cropChanged } from "@/app/store/slices/crop-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import type { AppDispatch, RootState } from "@/app/store/store";
import { FULL_CROP } from "@/domain/crop";
import {
  createEditorSnapshot,
  type EditorSnapshot,
  resolveEditorSnapshotTrim,
} from "@/domain/editor-snapshot";
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

export function applyEditorSnapshot(
  dispatch: AppDispatch,
  getState: () => RootState,
  snapshot: EditorSnapshot,
) {
  const media = selectSourceMedia(getState());
  if (!media) return;
  dispatch(
    trimChanged({
      trim: resolveEditorSnapshotTrim(snapshot.trim, media.durationMicros),
    }),
  );
  dispatch(
    cropChanged({
      crop: snapshot.crop ?? FULL_CROP,
      resolution: { width: media.video.width, height: media.video.height },
    }),
  );

  const master = selectMasterAudio(getState());
  dispatch(masterVolumeChanged({ volumePercent: snapshot.audio.master.volumePercent }));
  if (master.enabled !== snapshot.audio.master.enabled) dispatch(masterAudioToggled());
  for (const track of snapshot.audio.tracks) {
    dispatch(
      audioTrackVolumeChanged({
        streamIndex: track.streamIndex,
        volumePercent: track.volumePercent,
      }),
    );
    const current = selectAudioTracks(getState()).find(
      (candidate) => candidate.streamIndex === track.streamIndex,
    );

    if (current && current.enabled !== track.enabled) {
      dispatch(audioTrackToggled({ streamIndex: track.streamIndex }));
    }
  }
  if (selectMergeAudio(getState()) !== snapshot.audio.mergeAudio) dispatch(audioMergeToggled());
}
