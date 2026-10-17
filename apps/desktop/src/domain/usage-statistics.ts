/**
 * Raw cumulative statistics recorded natively after each successful export. Derived values are
 * computed by the helpers below so every consumer applies the same accounting rules.
 */
interface UsageStatistics {
  audioExports: number;
  firstExportAtMillis: number | null;
  gifExports: number;
  lastExportAtMillis: number | null;
  longestExportMillis: number;
  losslessExports: number;
  optimizedExports: number;
  outputBytes: number;
  processingMillis: number;
  sourceBytes: number;
}

function getCompletedExports(statistics: UsageStatistics): number {
  return (
    statistics.optimizedExports +
    statistics.losslessExports +
    statistics.gifExports +
    statistics.audioExports
  );
}

/** Source bytes minus output bytes; negative when exports were larger than their sources. */
function getStorageSavedBytes(statistics: UsageStatistics): number {
  return statistics.sourceBytes - statistics.outputBytes;
}

export { getCompletedExports, getStorageSavedBytes };
export type { UsageStatistics };
