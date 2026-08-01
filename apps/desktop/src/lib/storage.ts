export const STORAGE_KEYS = {
  preferences: "clipkit.preferences.v1",
  exportPresets: "clipkit.export-presets.v1",
} as const;

export function readStoredJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

export function writeStoredJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable or full. The app remains usable in memory.
  }
}
