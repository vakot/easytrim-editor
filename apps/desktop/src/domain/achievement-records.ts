/**
 * Achievement progress recorded natively because usage statistics cannot derive it. The native
 * store only ever adds entries and never changes an unlock time, so two snapshots merge safely.
 */
interface AchievementRecords {
  discoveredSplashMessageIds: string[];
  /** Unix epoch milliseconds when each achievement was first recognized as unlocked. */
  unlockedAchievements: Record<string, number>;
  /** When the collection was last viewed; achievements unlocked later are new to the user. */
  viewedAtMillis: number | null;
}

/** Combines two native snapshots, so a response that arrives late never hides a newer entry. */
function mergeAchievementRecords(
  current: AchievementRecords | null,
  incoming: AchievementRecords,
): AchievementRecords {
  if (!current) return incoming;
  return {
    discoveredSplashMessageIds: [
      ...new Set([...current.discoveredSplashMessageIds, ...incoming.discoveredSplashMessageIds]),
    ].sort(),
    unlockedAchievements: { ...incoming.unlockedAchievements, ...current.unlockedAchievements },
    viewedAtMillis: latestTimestamp(current.viewedAtMillis, incoming.viewedAtMillis),
  };
}

function latestTimestamp(left: number | null, right: number | null): number | null {
  if (left === null) return right;
  if (right === null) return left;
  return Math.max(left, right);
}

export { mergeAchievementRecords };
export type { AchievementRecords };
