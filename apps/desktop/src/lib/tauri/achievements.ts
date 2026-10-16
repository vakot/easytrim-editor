import { invoke } from "@tauri-apps/api/core";

import type { AchievementRecords } from "@/domain/achievement-records";

import type { AchievementUnlockResult } from "./achievements.types";
import { parseAchievementRecords, parseAchievementUnlockResult } from "./achievements.utils";
import { normalizeAppError } from "./media.utils";

async function getAchievementRecords(): Promise<AchievementRecords> {
  try {
    return parseAchievementRecords(await invoke<unknown>("get_achievement_records"));
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

/** Unlocks the achievements natively; the result names only those this call newly unlocked. */
async function unlockAchievements(
  achievementIds: readonly string[],
): Promise<AchievementUnlockResult> {
  try {
    return parseAchievementUnlockResult(
      await invoke<unknown>("unlock_achievements", { achievementIds }),
    );
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

async function recordSplashMessageDiscovery(messageId: string): Promise<AchievementRecords> {
  try {
    return parseAchievementRecords(
      await invoke<unknown>("record_splash_message_discovery", { messageId }),
    );
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export { getAchievementRecords, recordSplashMessageDiscovery, unlockAchievements };
