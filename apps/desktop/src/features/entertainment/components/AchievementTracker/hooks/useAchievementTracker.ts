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

import { getEarnedAchievementIds } from "../../../lib/achievements.utils";
import {
  createAchievementAnnouncement,
  showAchievementAnnouncement,
} from "../lib/achievement-announcement.utils";

/**
 * Unlocks achievements whenever the statistics or records they depend on change.
 *
 * The first evaluation of a session unlocks what the stored progress already earned without any
 * announcement, so a returning user is not greeted by a burst of retroactive toasts. Evaluations
 * run one after another against the latest store state, so none observes stale records.
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
        const announcement = createAchievementAnnouncement(unlocked, t);
        if (announcement) showAchievementAnnouncement(announcement);
      });
  }, [dispatch, records, statistics, store, t]);

  useEffect(() => {
    if (!initialized || announcementQueue.length === 0) return;
    const announcement = createAchievementAnnouncement(announcementQueue, t);
    if (announcement) showAchievementAnnouncement(announcement);
    dispatch(achievementAnnouncementsCleared());
  }, [announcementQueue, dispatch, initialized, t]);
}

export { useAchievementTracker };
