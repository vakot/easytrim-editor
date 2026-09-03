export interface SourceRef {
  displayName: string;
  sourcePath: string;
}

/**
 * Source paths are canonicalized by the native layer, but comparisons still
 * cross Redux, runtime, and platform-specific separator conventions.
 */
export function normalizeSourceKey(sourcePath: string): string {
  const normalized = sourcePath.replace(/[\\/]+/g, "/");
  return /^[A-Za-z]:\//.test(normalized) ? normalized.toLowerCase() : normalized;
}
