import {
  achievementRecordsLoaded,
  achievementRecordsLoadFailed,
  achievementRecordsRequested,
  achievementRecordsUpdated,
  selectAchievementRecords,
} from "@/app/store/slices/achievements-slice";
import {
  getAchievementRecords,
  recordSplashMessageDiscovery,
  unlockAchievements as unlockNativeAchievements,
} from "@/lib/tauri/achievements";

import type { AppThunk } from "./source-media-thunks";

/** Reads the native achievement records; only the latest request settles the load status. */
const loadAchievementRecords = (): AppThunk<Promise<void>> => async (dispatch) => {
  const requestId = crypto.randomUUID();
  dispatch(achievementRecordsRequested({ requestId }));
  try {
    const records = await getAchievementRecords();
    dispatch(achievementRecordsLoaded({ records, requestId }));
  } catch {
    dispatch(achievementRecordsLoadFailed({ requestId }));
  }
};

/**
 * Unlocks achievements natively and resolves with the ones this call newly unlocked. The native
 * store ignores achievements that are already unlocked, so repeated or concurrent requests never
 * report the same unlock twice. Resolves with null when the native store could not be reached.
 */
const unlockAchievements =
  (achievementIds: readonly string[]): AppThunk<Promise<string[] | null>> =>
  async (dispatch) => {
    if (achievementIds.length === 0) return [];
    try {
      const { records, unlockedAchievementIds } = await unlockNativeAchievements(achievementIds);
      dispatch(achievementRecordsUpdated({ records }));
      return unlockedAchievementIds;
    } catch {
      return null;
    }
  };

/** Records a displayed splash message, skipping the native call for a known discovery. */
const discoverSplashMessage =
  (messageId: string): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    if (selectAchievementRecords(getState())?.discoveredSplashMessageIds.includes(messageId)) {
      return;
    }
    try {
      const records = await recordSplashMessageDiscovery(messageId);
      dispatch(achievementRecordsUpdated({ records }));
    } catch {
      // The discovery is recorded the next time the message is displayed.
    }
  };

export { discoverSplashMessage, loadAchievementRecords, unlockAchievements };
