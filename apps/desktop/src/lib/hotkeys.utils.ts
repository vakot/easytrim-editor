const BLOCKING_SURFACES = [
  '[data-slot="dialog-content"][data-state="open"]',
  '[data-slot="alert-dialog-content"][data-state="open"]',
  '[data-slot="dropdown-menu-content"][data-state="open"]',
  '[data-slot="menubar-content"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[role="combobox"][aria-expanded="true"]',
  '[role="dialog"][data-state="open"]',
  '[role="listbox"][data-state="open"]',
  '[role="menu"][data-state="open"]',
].join(", ");

/** Marks a surface, such as a dialog that auditions edits, that keeps playback controllable. */
const PLAYBACK_SHORTCUT_SURFACE = "[data-playback-shortcuts]";

/** Controls that use Space or the arrow keys themselves. Sliders keep only their arrow keys. */
const KEYBOARD_CONTROLS = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  '[role="checkbox"]',
  '[role="combobox"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
].join(", ");

function isApplicationInteractionBlocked(): boolean {
  return typeof document !== "undefined" && document.querySelector(BLOCKING_SURFACES) !== null;
}

/**
 * Whether playback shortcuts are blocked. A surface marked as keeping playback controllable does
 * not block them, but a control focused inside it keeps its own keys, and anything opened above it
 * still blocks them.
 */
function isPlaybackShortcutBlocked(target: EventTarget | null): boolean {
  if (typeof document === "undefined") return false;
  const blocked = [...document.querySelectorAll(BLOCKING_SURFACES)].some(
    (surface) => surface.closest(PLAYBACK_SHORTCUT_SURFACE) === null,
  );

  return (
    blocked ||
    (target instanceof Element &&
      target.closest(PLAYBACK_SHORTCUT_SURFACE) !== null &&
      target.closest(KEYBOARD_CONTROLS) !== null)
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])") !==
      null
  );
}

export { isApplicationInteractionBlocked, isEditableTarget, isPlaybackShortcutBlocked };
