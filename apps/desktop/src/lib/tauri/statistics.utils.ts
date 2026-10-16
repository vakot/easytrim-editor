import type { UsageStatistics } from "@/domain/usage-statistics";

function parseUsageStatistics(value: unknown): UsageStatistics {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Invalid usage statistics response.");
  }
  const statistics = value as Record<string, unknown>;

  return {
    firstExportAtMillis: optionalTimestamp(statistics.firstExportAtMillis, "first export time"),
    lastExportAtMillis: optionalTimestamp(statistics.lastExportAtMillis, "last export time"),
    losslessExports: requireCount(statistics.losslessExports, "lossless exports"),
    outputBytes: requireCount(statistics.outputBytes, "output bytes"),
    processingMillis: requireCount(statistics.processingMillis, "processing time"),
    regularExports: requireCount(statistics.regularExports, "regular exports"),
    sourceBytes: requireCount(statistics.sourceBytes, "source bytes"),
  };
}

function requireCount(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`Invalid usage statistics ${label}.`);
  }
  return value;
}

function optionalTimestamp(value: unknown, label: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new TypeError(`Invalid usage statistics ${label}.`);
  }
  return value;
}

export { parseUsageStatistics };
