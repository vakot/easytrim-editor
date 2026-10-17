import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector, useAppStore } from "@/app/store/redux-hooks";
import {
  achievementAnnouncementsCleared,
  achievementsInitialized,
  selectAchievementAnnouncementQueue,
  selectAchievementRecords,
  selectAchievementsInitialized,
} from "@/app/store/slices/achievements-slice";
import { selectUsageStatistics } from "@/app/store/slices/usage-statistics-slice";
import { loadAchievementRecords, unlockAchievements } from "@/app/store/thunks/achievement-thunks";
import { loadUsageStatistics } from "@/app/store/thunks/usage-statistics-thunks";

import { useAchievementAnnouncementQueue } from "../../../hooks/useAchievementAnnouncementQueue";
import { createAchievementAnnouncements } from "../../../lib/achievement-announcements.utils";
import { getEarnedAchievementIds } from "../../../lib/achievements.utils";

/**
 * Unlocks achievements whenever the statistics or records they depend on change.
 *
 * The first evaluation of a session unlocks what the stored progress already earned without any
 * announcement, so a returning user is not greeted by a burst of retroactive toasts. Evaluations
 * run one after another against the latest store state, so none observes stale records. Every
 * newly unlocked achievement is announced on its own, one after another.
 */
function useAchievementTracker() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const records = useAppSelector(selectAchievementRecords);
  const announcementQueue = useAppSelector(selectAchievementAnnouncementQueue);
  const initialized = useAppSelector(selectAchievementsInitialized);
  const statistics = useAppSelector(selectUsageStatistics);
  const evaluations = useRef(Promise.resolve());
  const enqueueAnnouncements = useAchievementAnnouncementQueue();

  useEffect(() => {
    void dispatch(loadAchievementRecords());
    void dispatch(loadUsageStatistics());
  }, [dispatch]);

  useEffect(() => {
    if (!records || !statistics) return;

    // Catch before chaining, so one failed evaluation never stops all later ones.
    evaluations.current = evaluations.current
      .catch(() => undefined)
      .then(async () => {
        const state = store.getState();
        const initialized = selectAchievementsInitialized(state);
        const earned = getEarnedAchievementIds({
          records: selectAchievementRecords(state),
          statistics: selectUsageStatistics(state),
        });

        const unlocked = await dispatch(unlockAchievements(earned));
        // A failed first evaluation stays retroactive, so its achievements stay unannounced.
        if (unlocked === null) return;
        if (!initialized) {
          dispatch(achievementsInitialized());
          return;
        }
        enqueueAnnouncements(createAchievementAnnouncements(unlocked, t));
      });
  }, [dispatch, enqueueAnnouncements, records, statistics, store, t]);

  useEffect(() => {
    if (!initialized || announcementQueue.length === 0) return;
    enqueueAnnouncements(createAchievementAnnouncements(announcementQueue, t));
    dispatch(achievementAnnouncementsCleared());
  }, [announcementQueue, dispatch, enqueueAnnouncements, initialized, t]);
}

export { useAchievementTracker };
