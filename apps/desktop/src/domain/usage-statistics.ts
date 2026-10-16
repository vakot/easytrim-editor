/**
 * Raw cumulative statistics recorded natively after each successful export. Derived values are
 * computed by the helpers below so every consumer applies the same accounting rules.
 */
interface UsageStatistics {
  firstExportAtMillis: number | null;
  lastExportAtMillis: number | null;
  losslessExports: number;
  outputBytes: number;
  processingMillis: number;
  regularExports: number;
  sourceBytes: number;
}

function getCompletedExports(statistics: UsageStatistics): number {
  return statistics.regularExports + statistics.losslessExports;
}

/** Source bytes minus output bytes; negative when exports were larger than their sources. */
function getStorageSavedBytes(statistics: UsageStatistics): number {
  return statistics.sourceBytes - statistics.outputBytes;
}

export { getCompletedExports, getStorageSavedBytes };
export type { UsageStatistics };
