import {
  audioTrackProcessingChanged,
  audioTrackToggled,
  selectAudioTracks,
} from "@/app/store/slices/audio-slice";
import { selectSourceMedia, selectSourceReady } from "@/app/store/slices/source-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import type { AppDispatch } from "@/app/store/store";
import {
  audioTrackExternalPreviewStreamIndexes,
  sameAudioTrackPreviewProcessing,
} from "@/domain/audio-processing";

import { prepareTrackPreview } from "../../thunks/audio-track-thunks";
import { listenerMiddleware } from "../listener-middleware";

const TRIM_PREVIEW_REFRESH_DEBOUNCE_MS = 250;

listenerMiddleware.startListening({
  matcher: (
    action,
  ): action is
    | ReturnType<typeof trimChanged>
    | ReturnType<typeof audioTrackProcessingChanged>
    | ReturnType<typeof audioTrackToggled> =>
    trimChanged.match(action) ||
    audioTrackProcessingChanged.match(action) ||
    audioTrackToggled.match(action),
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
    if (trimChanged.match(action)) await listenerApi.delay(TRIM_PREVIEW_REFRESH_DEBOUNCE_MS);

    const state = listenerApi.getState();
    if (!selectSourceReady(state)) return;
    const tracks = selectAudioTracks(state);
    const audioStreams = selectSourceMedia(state)?.audioStreams ?? [];
    const nativeAudioStreamIndex =
      audioStreams.find((stream) => stream.isDefault)?.streamIndex ?? audioStreams[0]?.streamIndex;

    const requiredIndexes = audioTrackExternalPreviewStreamIndexes(tracks, nativeAudioStreamIndex);

    for (const streamIndex of requiredIndexes) {
      const track = tracks.find((candidate) => candidate.streamIndex === streamIndex);
      if (!track) continue;
      if (
        track.preview.status === "loading" ||
        (track.preview.status === "ready" &&
          sameAudioTrackPreviewProcessing(track.processing, track.preview.descriptor.processing))
      ) {
        continue;
      }
      if (listenerApi.signal.aborted) return;
      await (listenerApi.dispatch as AppDispatch)(prepareTrackPreview(streamIndex));
    }
  },
});
