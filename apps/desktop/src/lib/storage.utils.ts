function readStoredJson<T>(
  key: string,
  storage: "localStorage" | "sessionStorage" = "localStorage",
): T | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window[storage].getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function writeStoredJson(
  key: string,
  value: unknown,
  storage: "localStorage" | "sessionStorage" = "localStorage",
): void {
  if (typeof window === "undefined") return;
  try {
    window[storage].setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable or full. The app remains usable in memory.
  }
}

export { readStoredJson, writeStoredJson };
