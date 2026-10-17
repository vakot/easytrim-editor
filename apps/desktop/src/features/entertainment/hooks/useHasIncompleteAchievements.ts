import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAchievementRecords } from "@/app/store/slices/achievements-slice";

import { achievementCollection } from "../consts/achievements.consts";
import { isEntryLocked } from "../lib/achievements.utils";
import type { AchievementCategory } from "../types/achievements.types";

/** Hide discovery surfaces until persisted records are available, and after category completion. */
function useHasIncompleteAchievements(category: AchievementCategory): boolean {
  return useAppSelector((state) => {
    const records = selectAchievementRecords(state);
    return (
      records !== null &&
      achievementCollection.some(
        (entry) => entry.category === category && isEntryLocked(entry, records),
      )
    );
  });
}

export { useHasIncompleteAchievements };
