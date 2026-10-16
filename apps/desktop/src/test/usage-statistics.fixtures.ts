import type { UsageStatistics } from "@/domain/usage-statistics";

export const emptyUsageStatistics: UsageStatistics = {
  firstExportAtMillis: null,
  lastExportAtMillis: null,
  losslessExports: 0,
  outputBytes: 0,
  processingMillis: 0,
  regularExports: 0,
  sourceBytes: 0,
};
