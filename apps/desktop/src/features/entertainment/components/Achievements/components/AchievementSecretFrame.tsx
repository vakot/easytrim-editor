import type { AchievementSecretVariant } from "../../../types/achievements.types";

import styles from "./AchievementSecret.module.css";

/**
 * The decorative layers of a secret card: the gradient border ring, the prismatic sheen, and the
 * SVG gradient the iridescent icon strokes with. The card itself carries the data attributes.
 */
function AchievementSecretFrame({
  gradientId,
  variant,
}: {
  gradientId: string;
  variant: AchievementSecretVariant;
}) {
  return (
    <>
      <svg aria-hidden="true" className={styles.gradientDefs} focusable="false">
        <defs>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id={gradientId}
            x1="2"
            x2="22"
            y1="2"
            y2="22"
          >
            <stop offset="0" style={{ stopColor: "var(--achievement-secret-violet)" }} />
            <stop offset="0.35" style={{ stopColor: "var(--achievement-secret-azure)" }} />
            <stop offset="0.65" style={{ stopColor: "var(--achievement-secret-amber)" }} />
            <stop offset="1" style={{ stopColor: "var(--achievement-secret-rose)" }} />
          </linearGradient>
        </defs>
      </svg>
      <span aria-hidden="true" className={styles.frame} data-slot="achievement-secret-frame">
        <span className={styles.layer} />
      </span>
      {variant === "prismatic-holographic" ? (
        <span aria-hidden="true" className={styles.sheen} />
      ) : null}
    </>
  );
}

export { AchievementSecretFrame };
