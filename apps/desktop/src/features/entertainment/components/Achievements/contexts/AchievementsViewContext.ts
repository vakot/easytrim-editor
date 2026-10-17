import { createContext, useContext } from "react";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAchievementRecords } from "@/app/store/slices/achievements-slice";

/**
 * When the collection had last been viewed as this view opened: achievements unlocked later are
 * marked new for the whole view, even after it marks the collection viewed.
 */
const AchievementsViewContext = createContext<{ viewedAtMillis: number | null } | null>(null);

/** The viewed mark that decides what is new, falling back to the stored mark outside a view. */
function useAchievementsViewedAt(): number | null {
  const view = useContext(AchievementsViewContext);
  const storedViewedAt = useAppSelector(
    (state) => selectAchievementRecords(state)?.viewedAtMillis ?? null,
  );

  return view ? view.viewedAtMillis : storedViewedAt;
}

export { AchievementsViewContext, useAchievementsViewedAt };
