export function isApplicationDialogOpen(): boolean {
  return (
    typeof document !== "undefined" &&
    document.querySelector('[data-slot="dialog-content"][data-state="open"]') !== null
  );
}
