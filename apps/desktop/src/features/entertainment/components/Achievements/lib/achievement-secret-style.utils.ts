import type { CSSProperties } from "react";

import type { AchievementSecretStyle } from "../../../types/achievements.types";

/**
 * The attributes and custom properties that the secret card stylesheet reads. Everything visual is
 * decided in CSS from these, so the production card and the Storybook comparison share one path.
 */
function getAchievementSecretCardProps(
  style: AchievementSecretStyle,
  { gradientId, unlocked }: { gradientId: string; unlocked: boolean },
) {
  return {
    "data-secret-animated": String(style.animated),
    "data-secret-icon": style.iridescentIcon ? "iridescent" : "plain",
    "data-secret-state": unlocked ? "unlocked" : "locked",
    "data-secret-variant": style.variant,
    style: {
      "--secret-glow": clamp(style.glow, 0, 1),
      "--secret-icon-stroke": `url(#${gradientId})`,
      "--secret-thickness": `${clamp(style.thickness, 1, 6)}px`,
    } as CSSProperties,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export { getAchievementSecretCardProps };
