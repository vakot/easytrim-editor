import { audioTrackProcessingChanged, selectAudioTracks } from "@/app/store/slices/audio-slice";
import { selectSourceReady } from "@/app/store/slices/source-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import type { AppDispatch } from "@/app/store/store";
import { sameAudioTrackPreviewProcessing } from "@/domain/audio-processing";

import { prepareTrackPreview } from "../../thunks/audio-track-thunks";
import { listenerMiddleware } from "../listener-middleware";

const PREVIEW_REFRESH_DEBOUNCE_MS = 250;

listenerMiddleware.startListening({
  matcher: (
    action,
  ): action is ReturnType<typeof trimChanged> | ReturnType<typeof audioTrackProcessingChanged> =>
    trimChanged.match(action) || audioTrackProcessingChanged.match(action),
  effect: async (action, listenerApi) => {
    if (
      audioTrackProcessingChanged.match(action) &&
      sameAudioTrackPreviewProcessing(
        selectAudioTracks(listenerApi.getOriginalState()).find(
          (track) => track.streamIndex === action.payload.streamIndex,
        )?.processing ?? { gainDb: 0 },
        selectAudioTracks(listenerApi.getState()).find(
          (track) => track.streamIndex === action.payload.streamIndex,
        )?.processing ?? { gainDb: 0 },
      )
    ) {
      return;
    }

    listenerApi.cancelActiveListeners();
    await listenerApi.delay(PREVIEW_REFRESH_DEBOUNCE_MS);
    const state = listenerApi.getState();
    if (!selectSourceReady(state)) return;

    const tracks = selectAudioTracks(state).filter(
      (track) => track.processing.loudnessNormalization !== undefined,
    );

    const streamIndexes = tracks
      .filter(
        (track) =>
          trimChanged.match(action) ||
          track.streamIndex === action.payload.streamIndex ||
          track.preview.status === "stale",
      )
      .map((track) => track.streamIndex);

    for (const streamIndex of streamIndexes) {
      const track = tracks.find((candidate) => candidate.streamIndex === streamIndex);
      if (!track) continue;
      await (listenerApi.dispatch as AppDispatch)(prepareTrackPreview(streamIndex));
    }
  },
});
