type EditorShortcut =
  "toggle-playback" | "previous-frame" | "next-frame" | "set-segment-start" | "set-segment-end";

export type ShortcutDisposition = "timeline" | "local-control" | "native" | "ignored";

const TIMELINE_KEYBOARD_SELECTOR = "[data-editor-keyboard]";
const EDITABLE_SELECTOR = "input, textarea, [contenteditable]:not([contenteditable='false'])";
const COMPOSITE_CONTROL_SELECTOR = [
  "select",
  "[aria-haspopup]",
  '[role="alertdialog"]',
  '[role="combobox"]',
  '[role="dialog"]',
  '[role="grid"]',
  '[role="gridcell"]',
  '[role="listbox"]',
  '[role="menu"]',
  '[role="menubar"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="radio"]',
  '[role="radiogroup"]',
  '[role="row"]',
  '[role="spinbutton"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="tablist"]',
  '[role="toolbar"]',
  '[role="tree"]',
  '[role="treeitem"]',
  '[role="treegrid"]',
].join(", ");

const INDEPENDENT_SLIDER_SELECTOR = 'input[type="range"], [role="slider"]';

export type FrameShuttleDirection = -1 | 1;
export const FRAME_SHUTTLE_HOLD_DELAY_MS = 250;
export const FRAME_SHUTTLE_PLAYBACK_RATE = 2;

function editorShortcutFromEvent(event: globalThis.KeyboardEvent): EditorShortcut | null {
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

function shortcutDispositionFromEvent(event: globalThis.KeyboardEvent): ShortcutDisposition {
  const shortcut = editorShortcutFromEvent(event);
  if (!shortcut) return "ignored";

  const target = event.target instanceof Element ? event.target : null;
  const timelineControl = target?.closest<HTMLElement>(TIMELINE_KEYBOARD_SELECTOR);
  if (timelineControl?.dataset.editorKeyboard === "timeline-slider") {
    return shortcut === "previous-frame" || shortcut === "next-frame"
      ? "local-control"
      : "timeline";
  }
  if (timelineControl?.dataset.editorKeyboard === "timeline-transport") return "timeline";

  if (target?.closest(EDITABLE_SELECTOR) || target?.closest(COMPOSITE_CONTROL_SELECTOR)) {
    return "native";
  }
  if (target?.closest(INDEPENDENT_SLIDER_SELECTOR)) return "native";

  const button = target?.closest('button, [role="button"]');
  if (button && shortcut === "toggle-playback") return "native";

  return "timeline";
}

export { editorShortcutFromEvent, shortcutDispositionFromEvent };
