export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function isWindowsRuntime(): boolean {
  return (
    typeof navigator !== "undefined" &&
    (/Windows/i.test(navigator.userAgent) || /Win/i.test(navigator.platform))
  );
}
