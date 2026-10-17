import type { UsageStatistics } from "@/domain/usage-statistics";

export const emptyUsageStatistics: UsageStatistics = {
  audioExports: 0,
  firstExportAtMillis: null,
  gifExports: 0,
  lastExportAtMillis: null,
  longestExportMillis: 0,
  losslessExports: 0,
  outputBytes: 0,
  processingMillis: 0,
  optimizedExports: 0,
  sourceBytes: 0,
};
