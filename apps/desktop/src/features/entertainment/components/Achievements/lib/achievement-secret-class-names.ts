import styles from "../components/AchievementSecret.module.css";

/** Class names for the secret card and its icon; the frame supplies the rest of the treatment. */
const achievementSecretClassNames = {
  card: styles.card,
  medallion: styles.medallion,
} as const;

export { achievementSecretClassNames };
