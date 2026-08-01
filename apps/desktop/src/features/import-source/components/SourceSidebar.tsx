import type { SessionState } from "@/app/session-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExportQueue, type ExportToast } from "@/features/export/ExportPanel";
import { MediaDetails } from "./MediaDetails";
import { SourceError } from "./SourceError";

interface SourceSidebarProps {
  session: SessionState;
  queue: ExportToast[];
}

export function SourceSidebar({ session, queue }: SourceSidebarProps) {
  if (!session.source) {
    return null;
  }

  return (
    <ScrollArea className="h-full">
      <aside className="grid content-start gap-5 p-5" aria-labelledby="source-title">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-bold tracking-[0.14em] text-primary uppercase">
            Source details
          </p>
          <h1
            id="source-title"
            className="truncate text-base font-semibold"
            title={session.source.selection.displayName}
          >
            {session.source.selection.displayName}
          </h1>
          {session.status === "loading-source" ? (
            <span className="text-xs text-muted-foreground" role="status">
              Inspecting…
            </span>
          ) : null}
        </div>

        {session.lastError ? <SourceError error={session.lastError} /> : null}
        {session.status === "ready" && session.source.media ? (
          <MediaDetails media={session.source.media} />
        ) : null}
        <ExportQueue queue={queue} />
      </aside>
    </ScrollArea>
  );
}
