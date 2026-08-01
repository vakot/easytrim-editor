import styles from "./styles.module.css";

const ROW_COUNT = 4;
const WORD_COUNT = 14;

export function WelcomeBrandWall() {
  return (
    <div className={styles.wall} aria-hidden="true">
      {Array.from({ length: ROW_COUNT }, (_, rowIndex) => (
        <div className={styles.row} key={rowIndex}>
          <div className={styles.track}>
            {Array.from({ length: 2 }, (_, setIndex) => (
              <div className={styles.set} key={setIndex}>
                {Array.from({ length: WORD_COUNT }, (_, wordIndex) => (
                  <span className={styles.mark} key={wordIndex}>
                    {wordIndex % 2 === 0 ? "EASY" : "TRIM"}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
