import type { AchievementSecretStyle } from "../types/achievements.types";

/**
 * The style secret achievement cards use. The variant is provisional while the alternatives are
 * compared in Storybook.
 */
const defaultAchievementSecretStyle: AchievementSecretStyle = {
  animated: true,
  glow: 0.6,
  iridescentIcon: true,
  thickness: 2,
  variant: "static-iridescent",
};

export { defaultAchievementSecretStyle };
