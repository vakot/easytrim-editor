import { cn } from "../lib/class-names.utils";

import { Ping } from "./ping";

/** Marks something unlocked since the collection was last viewed. Purely visual. */
function AchievementNewPing({ className }: { className?: string }) {
  return (
    <Ping
      aria-hidden="true"
      className={cn("motion-reduce:before:animate-none", className)}
      data-slot="achievement-new"
    />
  );
}

export { AchievementNewPing };
