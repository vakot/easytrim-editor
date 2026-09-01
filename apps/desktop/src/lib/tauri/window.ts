import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

function getNativeWindow() {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return null;
  }

  return getCurrentWindow();
}

export function startWindowDragging(): Promise<void> {
  return getNativeWindow()?.startDragging() ?? Promise.resolve();
}

export function minimizeWindow(): Promise<void> {
  return getNativeWindow()?.minimize() ?? Promise.resolve();
}

export function toggleWindowMaximize(): Promise<void> {
  return getNativeWindow()?.toggleMaximize() ?? Promise.resolve();
}

export function closeWindow(): Promise<void> {
  return getNativeWindow()?.close() ?? Promise.resolve();
}

export function listenForWindowCloseRequests(
  shouldPreventClose: () => boolean,
  onCloseRequested: () => void,
): Promise<UnlistenFn> {
  return (
    getNativeWindow()?.onCloseRequested((event) => {
      if (!shouldPreventClose()) return;
      event.preventDefault();
      onCloseRequested();
    }) ?? Promise.resolve(() => undefined)
  );
}

export function isWindowMaximized(): Promise<boolean> {
  return getNativeWindow()?.isMaximized() ?? Promise.resolve(false);
}
