import { useAchievementTracker } from "./hooks/useAchievementTracker";

/** Keeps achievements unlocked as progress changes and announces new unlocks. Renders nothing. */
function AchievementTracker() {
  useAchievementTracker();
  return null;
}

export { AchievementTracker };
