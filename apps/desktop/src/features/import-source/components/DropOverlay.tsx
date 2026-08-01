import { FileVideo2, Plus } from "lucide-react";

export function DropOverlay() {
  return (
    <div
      className="absolute inset-0 z-40 grid place-items-center bg-background/82 backdrop-blur-sm"
      role="status"
      aria-label="Drop video to open"
      aria-live="polite"
    >
      <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-primary/70 bg-card/95 px-10 py-8 text-center shadow-2xl">
        <span className="relative grid size-12 place-items-center rounded-full bg-primary/12 text-primary">
          <FileVideo2 className="size-6" aria-hidden="true" />
          <Plus className="absolute -right-0.5 -bottom-0.5 size-4 rounded-full bg-primary p-0.5 text-primary-foreground" />
        </span>
        <strong>Drop video to open</strong>
        <span className="text-xs text-muted-foreground">The current edit will be reset.</span>
      </div>
    </div>
  );
}
