import { useId } from "react";

/** A unique SVG gradient id, safe to reference as `url(#id)` from CSS. */
function useAchievementSecretGradientId(): string {
  return `achievement-secret-${useId().replace(/\W/g, "")}`;
}

export { useAchievementSecretGradientId };
