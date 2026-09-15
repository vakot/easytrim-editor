export function isApplicationInteractionBlocked(): boolean {
  return (
    typeof document !== "undefined" &&
    document.querySelector(
      [
        '[data-slot="dialog-content"][data-state="open"]',
        '[data-slot="alert-dialog-content"][data-state="open"]',
        '[data-slot="dropdown-menu-content"][data-state="open"]',
        '[data-slot="menubar-content"][data-state="open"]',
        '[role="alertdialog"][data-state="open"]',
        '[role="combobox"][aria-expanded="true"]',
        '[role="dialog"][data-state="open"]',
        '[role="listbox"][data-state="open"]',
        '[role="menu"][data-state="open"]',
      ].join(", "),
    ) !== null
  );
}

export function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])") !==
      null
  );
}
