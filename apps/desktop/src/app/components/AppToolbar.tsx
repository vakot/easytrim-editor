import { Button } from "@/components/ui/button";
import type { SessionState } from "@/app/session-state";
import { CapabilityStatus } from "@/features/import-source/SourceWorkspace";
import { ExportPanel, type ExportToast } from "@/features/export";
import type { Dispatch, SetStateAction } from "react";

interface AppToolbarProps {
  session: SessionState;
  isChoosingSource: boolean;
  setExportQueue: Dispatch<SetStateAction<ExportToast[]>>;
  onChooseSource: () => void;
  onReturnToWelcome: () => void;
  onNativeDialogStateChange: (open: boolean) => void;
}

export function AppToolbar({
  session,
  isChoosingSource,
  setExportQueue,
  onChooseSource,
  onReturnToWelcome,
  onNativeDialogStateChange,
}: AppToolbarProps) {
  return (
    <div
      className="grid h-[4.25rem] grid-cols-[1fr_auto_1fr] items-center border-b border-border bg-background px-5"
      role="toolbar"
      aria-label="Application toolbar"
    >
      <button
        className="w-fit font-heading text-xl font-bold tracking-[0.08em] text-primary outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
        type="button"
        aria-label="Return to CLIP KIT welcome page"
        onClick={onReturnToWelcome}
      >
        CLIP KIT
      </button>
      <CapabilityStatus capabilities={session.capabilities} />
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" size="lg" onClick={onChooseSource} disabled={isChoosingSource}>
          {isChoosingSource ? "Opening…" : "Open video"}
        </Button>
        {session.status === "ready" && session.source?.media && session.source.trim ? (
          <ExportPanel
            key={`export-${session.source.selection.sourceId}`}
            source={session.source.media}
            sourceName={session.source.selection.displayName}
            trim={session.source.trim}
            audioTracks={session.source.audioTracks}
            masterEnabled={session.source.masterEnabled}
            masterVolumePercent={session.source.masterVolumePercent}
            mergeAudio={session.source.mergeAudio}
            setQueue={setExportQueue}
            onNativeDialogStateChange={onNativeDialogStateChange}
          />
        ) : null}
      </div>
    </div>
  );
}
