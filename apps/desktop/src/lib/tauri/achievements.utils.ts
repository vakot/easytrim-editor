import type { AchievementRecords } from "@/domain/achievement-records";

import type { AchievementUnlockResult } from "./achievements.types";

function parseAchievementRecords(value: unknown): AchievementRecords {
  const records = requireRecord(value, "records");
  const unlocked = requireRecord(records.unlockedAchievements, "unlocked achievements");
  if (!Array.isArray(records.discoveredSplashMessageIds)) {
    throw new TypeError("Invalid achievement discovered splash messages.");
  }

  return {
    discoveredSplashMessageIds: records.discoveredSplashMessageIds.map((id) =>
      requireIdentifier(id, "discovered splash message"),
    ),
    unlockedAchievements: Object.fromEntries(
      Object.entries(unlocked).map(([id, unlock]) => [
        requireIdentifier(id, "unlocked achievement"),
        requireTimestamp(requireRecord(unlock, "unlock").unlockedAtMillis),
      ]),
    ),
    viewedAtMillis:
      records.viewedAtMillis === null || records.viewedAtMillis === undefined
        ? null
        : requireTimestamp(records.viewedAtMillis),
  };
}

function parseAchievementUnlockResult(value: unknown): AchievementUnlockResult {
  const result = requireRecord(value, "unlock result");
  if (!Array.isArray(result.unlockedAchievementIds)) {
    throw new TypeError("Invalid achievement unlock result.");
  }

  return {
    records: parseAchievementRecords(result.records),
    unlockedAchievementIds: result.unlockedAchievementIds.map((id) =>
      requireIdentifier(id, "unlocked achievement"),
    ),
  };
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`Invalid achievement ${label}.`);
  }
  return value as Record<string, unknown>;
}

function requireIdentifier(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`Invalid achievement ${label} identifier.`);
  }
  return value;
}

function requireTimestamp(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new TypeError("Invalid achievement unlock time.");
  }
  return value;
}

export { parseAchievementRecords, parseAchievementUnlockResult };
