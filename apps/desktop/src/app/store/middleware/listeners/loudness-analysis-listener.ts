import { isAnyOf } from "@reduxjs/toolkit";

import { editingInstanceActivated } from "@/app/store/actions/editing-instance-actions";
import { sourceCleared, sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { workspaceHistoryTransitionCommitted } from "@/app/store/actions/workspace-history-actions";
import {
  audioFilterPreviewChanged,
  audioFilterPreviewEnded,
  audioFilterPreviewStarted,
  audioTrackFiltersApplied,
  audioTrackToggled,
  selectAudioTracks,
} from "@/app/store/slices/audio-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import type { AppDispatch } from "@/app/store/store";
import {
  analyzeFilterPreviewLoudness,
  analyzeTrackLoudness,
  releaseUnawaitedPreviewLoudnessAnalyses,
} from "@/app/store/thunks/audio-track-thunks";
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
    workspaceHistoryTransitionCommitted,
  ),
  effect: async (action, { cancelActiveListeners, delay, dispatch, getState }) => {
    if (workspaceHistoryTransitionCommitted.match(action) && !action.payload.analysisChanged)
      return;
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

/*
 * A previewed draft is measured as soon as its loudness inputs settle, so normalized audio is
 * ready to audition without Apply. A measurement of inputs the draft has moved away from stops
 * right away unless the committed chain waits for it; the native cache keeps every completed
 * measurement, so returning to earlier inputs does not measure them again.
 */
listenerMiddleware.startListening({
  matcher: isAnyOf(
    audioFilterPreviewStarted,
    audioFilterPreviewChanged,
    trimChanged,
    workspaceHistoryTransitionCommitted,
  ),
  effect: async (action, { cancelActiveListeners, delay, dispatch, getState }) => {
    if (workspaceHistoryTransitionCommitted.match(action) && !action.payload.analysisChanged)
      return;
    releaseUnawaitedPreviewLoudnessAnalyses(getState());
    cancelActiveListeners();
    await delay(ANALYSIS_DEBOUNCE_MS);
    void (dispatch as AppDispatch)(analyzeFilterPreviewLoudness());
  },
});

listenerMiddleware.startListening({
  matcher: isAnyOf(
    audioFilterPreviewEnded,
    audioTrackFiltersApplied,
    editingInstanceActivated,
    sourceCleared,
    sourceSelected,
    workspaceHistoryTransitionCommitted,
  ),
  effect: (_action, { getState }) => releaseUnawaitedPreviewLoudnessAnalyses(getState()),
});
