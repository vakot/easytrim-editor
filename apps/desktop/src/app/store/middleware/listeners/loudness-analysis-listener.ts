import { isAnyOf } from "@reduxjs/toolkit";

import { editingInstanceActivated } from "@/app/store/actions/editing-instance-actions";
import { sourceReady } from "@/app/store/actions/source-actions";
import {
  audioTrackFiltersApplied,
  audioTrackToggled,
  selectAudioTracks,
} from "@/app/store/slices/audio-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import type { AppDispatch } from "@/app/store/store";
import { analyzeTrackLoudness } from "@/app/store/thunks/audio-track-thunks";
import { audioFiltersRequireLoudnessAnalysis } from "@/domain/audio-processing";

import { listenerMiddleware } from "../listener-middleware";

// Coalesces bursts such as consecutive trim edits into one measurement.
const ANALYSIS_DEBOUNCE_MS = 300;

/*
 * Loudness normalization cannot render until the signal reaching it is measured, and playback
 * waits for that measurement. Measure every enabled track whose current chain needs it once its
 * inputs settle. Native measurements are cached by their exact inputs, so unchanged inputs return
 * immediately; a failed measurement is not retried automatically.
 */
listenerMiddleware.startListening({
  matcher: isAnyOf(
    audioTrackFiltersApplied,
    audioTrackToggled,
    editingInstanceActivated,
    sourceReady,
    trimChanged,
  ),
  effect: async (_action, { cancelActiveListeners, delay, dispatch, getState }) => {
    cancelActiveListeners();
    await delay(ANALYSIS_DEBOUNCE_MS);
    for (const track of selectAudioTracks(getState())) {
      if (
        track.enabled &&
        track.loudnessAnalysis.status === "idle" &&
        audioFiltersRequireLoudnessAnalysis(track.processing.filters)
      ) {
        void (dispatch as AppDispatch)(analyzeTrackLoudness(track.streamIndex));
      }
    }
  },
});
