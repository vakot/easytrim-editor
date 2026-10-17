import { createContext, useContext } from "react";

import { defaultAchievementSecretStyle } from "../../../consts/achievement-secret-style.consts";
import type { AchievementSecretStyle } from "../../../types/achievements.types";

/** Overrides the secret achievement style below it, such as to compare variants side by side. */
const AchievementSecretStyleContext = createContext<AchievementSecretStyle>(
  defaultAchievementSecretStyle,
);

function useAchievementSecretStyle(): AchievementSecretStyle {
  return useContext(AchievementSecretStyleContext);
}

export { AchievementSecretStyleContext, useAchievementSecretStyle };
