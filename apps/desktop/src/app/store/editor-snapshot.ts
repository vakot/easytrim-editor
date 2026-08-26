import {
  audioMergeToggled,
  audioTrackToggled,
  audioTrackVolumeChanged,
  masterAudioToggled,
  masterVolumeChanged,
  selectAudioTracks,
  selectMasterAudio,
  selectMergeAudio,
} from "@/app/store/slices/audio-slice";
import { cropChanged } from "@/app/store/slices/crop-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import { FULL_CROP } from "@/domain/crop";
import type { EditorSnapshot } from "@/domain/editor-snapshot";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import type { AppDispatch, RootState } from "@/app/store/store";

export function applyEditorSnapshot(
  dispatch: AppDispatch,
  getState: () => RootState,
  snapshot: EditorSnapshot,
) {
  const media = selectSourceMedia(getState());
  if (!media) return;
  dispatch(
    trimChanged({
      trim: { ...snapshot.trim, sourceDurationMicros: media.durationMicros },
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
