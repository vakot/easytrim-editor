import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

const WINDOW_CLOSE_BUTTON_REQUESTED = "easytrim:window-close-button-requested";

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

export function requestWindowClose(): Promise<void> {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(WINDOW_CLOSE_BUTTON_REQUESTED));
  }

  return Promise.resolve();
}

export function listenForWindowCloseButtonRequests(onCloseRequested: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handleCloseRequested = () => onCloseRequested();
  window.addEventListener(WINDOW_CLOSE_BUTTON_REQUESTED, handleCloseRequested);

  return () => window.removeEventListener(WINDOW_CLOSE_BUTTON_REQUESTED, handleCloseRequested);
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
