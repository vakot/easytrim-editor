import { sourceReady } from "@/app/store/actions/source-actions";
import { timelineShortcutExecuted } from "@/app/store/actions/timeline-actions";
import { selectAchievementRecords } from "@/app/store/slices/achievements-slice";
import { audioTrackFiltersApplied, selectAudioTracks } from "@/app/store/slices/audio-slice";
import { cropChanged, selectCropApplied } from "@/app/store/slices/crop-slice";
import {
  editingInstanceExportAttemptQueued,
  selectEditingInstanceById,
} from "@/app/store/slices/editing-instances-slice";
import { selectTrim, trimChanged } from "@/app/store/slices/trim-slice";
import type { AppDispatch, RootState } from "@/app/store/store";
import { unlockAchievements } from "@/app/store/thunks/achievement-thunks";

import { listenerMiddleware } from "../listener-middleware";

type OnboardingAchievementId =
  | "cut-to-the-chase"
  | "first-contact"
  | "fine-tuning"
  | "frame-by-frame"
  | "queued-up"
  | "shortcut-taken";

function unlockOnboardingAchievement(
  id: OnboardingAchievementId,
  dispatch: AppDispatch,
  getState: () => RootState,
) {
  if (selectAchievementRecords(getState())?.unlockedAchievements[id] !== undefined) return;
  void dispatch(unlockAchievements([id], { announce: true }));
}

listenerMiddleware.startListening({
  actionCreator: sourceReady,
  effect: (_action, api) => {
    // sourceReady only follows successful source activation and inspection. A restored snapshot
    // also proves that the user imported a media file in an earlier session.
    unlockOnboardingAchievement("first-contact", api.dispatch as AppDispatch, api.getState);
  },
});

listenerMiddleware.startListening({
  actionCreator: trimChanged,
  effect: (_action, api) => {
    const before = selectTrim(api.getOriginalState());
    const after = selectTrim(api.getState());
    if (
      !after ||
      (before?.startMicros === after.startMicros && before.endMicros === after.endMicros)
    )
      return;
    if (after.startMicros > 0 || after.endMicros < after.sourceDurationMicros) {
      unlockOnboardingAchievement("cut-to-the-chase", api.dispatch as AppDispatch, api.getState);
    }
  },
});

listenerMiddleware.startListening({
  actionCreator: cropChanged,
  effect: (_action, api) => {
    const before = api.getOriginalState();
    const after = api.getState();
    if (!selectCropApplied(before) && selectCropApplied(after)) {
      unlockOnboardingAchievement("frame-by-frame", api.dispatch as AppDispatch, api.getState);
    }
  },
});

listenerMiddleware.startListening({
  actionCreator: audioTrackFiltersApplied,
  effect: (action, api) => {
    const before = selectAudioTracks(api.getOriginalState()).find(
      (track) => track.streamIndex === action.payload.streamIndex,
    );

    const after = selectAudioTracks(api.getState()).find(
      (track) => track.streamIndex === action.payload.streamIndex,
    );

    if (
      after &&
      after.processing.filters.length > 0 &&
      before?.processing.filters !== after.processing.filters
    ) {
      unlockOnboardingAchievement("fine-tuning", api.dispatch as AppDispatch, api.getState);
    }
  },
});

listenerMiddleware.startListening({
  actionCreator: editingInstanceExportAttemptQueued,
  effect: (action, api) => {
    const { attempt, id } = action.payload;
    const existedBefore = selectEditingInstanceById(
      api.getOriginalState(),
      id,
    )?.exportAttempts.some((candidate) => candidate.id === attempt.id);

    const existsAfter = selectEditingInstanceById(api.getState(), id)?.exportAttempts.some(
      (candidate) => candidate.id === attempt.id,
    );

    if (!existedBefore && existsAfter) {
      unlockOnboardingAchievement("queued-up", api.dispatch as AppDispatch, api.getState);
    }
  },
});

listenerMiddleware.startListening({
  actionCreator: timelineShortcutExecuted,
  effect: (_action, api) => {
    unlockOnboardingAchievement("shortcut-taken", api.dispatch as AppDispatch, api.getState);
  },
});

export {};
