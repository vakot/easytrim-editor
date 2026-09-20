interface SourceRef {
  createdAtMicros?: number;
  displayName: string;
  sourcePath: string;
  updatedAtMicros?: number;
}

/**
 * Source paths are canonicalized by the native layer, but comparisons still
 * cross Redux, runtime, and platform-specific separator conventions.
 */
function normalizeSourceKey(sourcePath: string): string {
  const normalized = sourcePath.replace(/[\\/]+/g, "/");
  return /^[A-Za-z]:\//.test(normalized) ? normalized.toLowerCase() : normalized;
}

export { normalizeSourceKey };

export type { SourceRef };
