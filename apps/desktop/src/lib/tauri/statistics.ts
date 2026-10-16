import { invoke } from "@tauri-apps/api/core";

import type { UsageStatistics } from "@/domain/usage-statistics";

import { normalizeAppError } from "./media.utils";
import { parseUsageStatistics } from "./statistics.utils";

async function getUsageStatistics(): Promise<UsageStatistics> {
  try {
    return parseUsageStatistics(await invoke<unknown>("get_usage_statistics"));
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export { getUsageStatistics };
