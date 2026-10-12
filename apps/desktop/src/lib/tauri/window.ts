import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { clearWorkspaceRecoveryOnAcceptedShutdown } from "@/app/store/recovery/workspace-recovery";

const WINDOW_SHUTDOWN_REQUESTED = "easytrim:window-shutdown-requested";

export type WindowShutdownContinuation = () => void | Promise<void>;

function getNativeWindow() {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return null;
  }

  return getCurrentWindow();
}

function startWindowDragging(): Promise<void> {
  return getNativeWindow()?.startDragging() ?? Promise.resolve();
}

function minimizeWindow(): Promise<void> {
  return getNativeWindow()?.minimize() ?? Promise.resolve();
}

function toggleWindowMaximize(): Promise<void> {
  return getNativeWindow()?.toggleMaximize() ?? Promise.resolve();
}

function closeWindow(): Promise<void> {
  return getNativeWindow()?.close() ?? Promise.resolve();
}

function destroyWindow(): Promise<void> {
  return getNativeWindow()?.destroy() ?? Promise.resolve();
}

function requestWindowShutdown(continuation?: WindowShutdownContinuation): Promise<void> {
  if (typeof window !== "undefined") {
    const event = new CustomEvent(WINDOW_SHUTDOWN_REQUESTED, {
      cancelable: true,
      detail: continuation,
    });

    window.dispatchEvent(event);

    if (event.defaultPrevented || continuation) return Promise.resolve();
  }

  return closeWindow();
}

async function completeShutdown(continuation?: WindowShutdownContinuation) {
  await clearWorkspaceRecoveryOnAcceptedShutdown();

  if (continuation) {
    await continuation();
  } else {
    await destroyWindow();
  }
}

function listenForWindowShutdownRequests(
  onShutdownRequested: (continuation?: WindowShutdownContinuation) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handleShutdownRequested = (event: Event) => {
    const continuation =
      event instanceof CustomEvent && typeof event.detail === "function"
        ? (event.detail as WindowShutdownContinuation)
        : undefined;

    event.preventDefault();
    onShutdownRequested(continuation);
  };

  window.addEventListener(WINDOW_SHUTDOWN_REQUESTED, handleShutdownRequested);

  return () => window.removeEventListener(WINDOW_SHUTDOWN_REQUESTED, handleShutdownRequested);
}

function listenForWindowCloseRequests(onCloseRequested: () => void): Promise<UnlistenFn> {
  return (
    getNativeWindow()?.onCloseRequested((event) => {
      event.preventDefault();
      onCloseRequested();
    }) ?? Promise.resolve(() => undefined)
  );
}

function isWindowMaximized(): Promise<boolean> {
  return getNativeWindow()?.isMaximized() ?? Promise.resolve(false);
}

export {
  closeWindow,
  completeShutdown,
  destroyWindow,
  isWindowMaximized,
  listenForWindowCloseRequests,
  listenForWindowShutdownRequests,
  minimizeWindow,
  requestWindowShutdown,
  startWindowDragging,
  toggleWindowMaximize,
};
