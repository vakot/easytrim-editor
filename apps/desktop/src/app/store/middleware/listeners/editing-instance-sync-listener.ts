import { isAnyOf } from "@reduxjs/toolkit";

import { editingInstanceActivated } from "@/app/store/actions/editing-instance-actions";
import { sourceReady } from "@/app/store/actions/source-actions";
import {
  audioMergeToggled,
  audioTrackToggled,
  audioTrackVolumeChanged,
  masterAudioToggled,
  masterVolumeChanged,
} from "@/app/store/slices/audio-slice";
import { cropChanged } from "@/app/store/slices/crop-slice";
import {
  editingInstanceOptimizedSettingsChanged,
  editingInstanceSnapshotUpdated,
  selectActiveEditingInstance,
} from "@/app/store/slices/editing-instances-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import { createEditorSnapshot } from "@/domain/editor-snapshot";

import { listenerMiddleware } from "../listener-middleware";

const snapshotEditingActions = isAnyOf(
  trimChanged,
  cropChanged,
  audioMergeToggled,
  audioTrackToggled,
  audioTrackVolumeChanged,
  masterAudioToggled,
  masterVolumeChanged,
  sourceReady,
  editingInstanceActivated,
);

listenerMiddleware.startListening({
  matcher: snapshotEditingActions,
  effect: (_, listenerApi) => {
    const state = listenerApi.getState();
    const instance = selectActiveEditingInstance(state);
    const source = state.source.source;
    const trim = state.trim.value;
    if (!instance || !source || !trim || !state.source.media) return;
    listenerApi.dispatch(
      editingInstanceSnapshotUpdated({
        id: instance.id,
        media: state.source.media,
        snapshot: createEditorSnapshot({
          source,
          trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
          crop: state.crop.value,
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
        }),
      }),
    );
  },
});

listenerMiddleware.startListening({
  actionCreator: cropChanged,
  effect: (action, listenerApi) => {
    const instance = selectActiveEditingInstance(listenerApi.getState());
    if (!instance) return;
    listenerApi.dispatch(
      editingInstanceOptimizedSettingsChanged({
        id: instance.id,
        settings: {
          frameRate: instance.optimizedSettings?.frameRate,
          resolution: action.payload.resolution,
        },
      }),
    );
  },
});
