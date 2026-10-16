import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAchievementRecords } from "@/app/store/slices/achievements-slice";

import { hasNewAchievements } from "../lib/achievements.utils";

/** Whether achievements were unlocked since the collection was last viewed. */
function useHasNewAchievements(): boolean {
  return useAppSelector((state) => hasNewAchievements(selectAchievementRecords(state)));
}

export { useHasNewAchievements };
