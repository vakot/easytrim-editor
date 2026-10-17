import styles from "./AchievementSecret.module.css";

/**
 * Defines the iridescent gradient that secret achievement icons use as their stroke. Pair it with
 * `--secret-icon-stroke: url(#id)` on the styled container.
 */
function AchievementSecretGradient({ id }: { id: string }) {
  return (
    <svg aria-hidden="true" className={styles.gradientDefs} focusable="false">
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id={id} x1="2" x2="22" y1="2" y2="22">
          <stop offset="0" style={{ stopColor: "var(--achievement-secret-violet)" }} />
          <stop offset="0.35" style={{ stopColor: "var(--achievement-secret-azure)" }} />
          <stop offset="0.65" style={{ stopColor: "var(--achievement-secret-amber)" }} />
          <stop offset="1" style={{ stopColor: "var(--achievement-secret-rose)" }} />
        </linearGradient>
      </defs>
    </svg>
  );
}

export { AchievementSecretGradient };
