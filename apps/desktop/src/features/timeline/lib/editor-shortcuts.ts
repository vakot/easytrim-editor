type EditorShortcut =
  "toggle-playback" | "previous-frame" | "next-frame" | "set-segment-start" | "set-segment-end";

export type FrameShuttleDirection = -1 | 1;
export const FRAME_SHUTTLE_HOLD_DELAY_MS = 250;
export const FRAME_SHUTTLE_PLAYBACK_RATE = 2;

export function editorShortcutFromEvent(event: globalThis.KeyboardEvent): EditorShortcut | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  switch (event.code) {
    case "Space":
      return "toggle-playback";
    case "ArrowLeft":
      return "previous-frame";
    case "ArrowRight":
      return "next-frame";
    case "KeyI":
      return "set-segment-start";
    case "KeyO":
      return "set-segment-end";
    default:
      return null;
  }
}

export function isShortcutBlockedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) {
    return true;
  }
  const button = target.closest("button");
  return button !== null && button.dataset.editorShortcut !== "true";
}
