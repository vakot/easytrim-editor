import { LoaderCircle } from "lucide-react";

export function NativeDialogOverlay() {
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/55 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="grid min-w-64 justify-items-center gap-2 rounded-xl border border-border bg-popover p-6 text-center shadow-2xl">
        <LoaderCircle className="size-6 animate-spin text-primary" aria-hidden="true" />
        <strong className="text-sm">Waiting for system dialog</strong>
        <span className="text-xs text-muted-foreground">Choose a file location to continue.</span>
      </div>
    </div>
  );
}
