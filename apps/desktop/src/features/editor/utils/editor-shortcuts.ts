export type EditorShortcut =
  "toggle-playback" | "previous-frame" | "next-frame" | "set-segment-start" | "set-segment-end";

export function editorShortcutFromEvent(event: globalThis.KeyboardEvent): EditorShortcut | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  switch (event.key.toLowerCase()) {
    case " ":
      return "toggle-playback";
    case "arrowleft":
      return "previous-frame";
    case "arrowright":
      return "next-frame";
    case "i":
      return "set-segment-start";
    case "o":
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
