export function isApplicationDialogOpen(): boolean {
  return (
    typeof document !== "undefined" &&
    document.querySelector('[data-slot="dialog-content"][data-state="open"]') !== null
  );
}

export function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])") !==
      null
  );
}
