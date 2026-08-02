import type { ReactNode } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useTimelinePaneMeasurements } from "../hooks/useTimelinePaneMeasurements";
import type { TimelinePanelSizeConstraints } from "../utils/timeline-pane-sizing";

interface TimelinePaneProps {
  timeline: ReactNode;
  audioTracks: ReactNode | null;
  onSizeConstraintsChange: (constraints: TimelinePanelSizeConstraints) => void;
}

export function TimelinePane({
  timeline,
  audioTracks,
  onSizeConstraintsChange,
}: TimelinePaneProps) {
  const hasAudioTracks = audioTracks !== null;
  const { timelineRef, audioContentRef } = useTimelinePaneMeasurements(
    onSizeConstraintsChange,
    hasAudioTracks,
  );

  return (
    <div
      className={
        hasAudioTracks
          ? "grid size-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-background"
          : "size-full min-h-0 min-w-0 overflow-hidden bg-background"
      }
    >
      <div ref={timelineRef} className="min-w-0" data-testid="timeline-fixed-content">
        {timeline}
      </div>
      {hasAudioTracks ? (
        <ScrollArea type="auto" className="min-h-0 min-w-0" data-testid="audio-tracks-scroll">
          <div ref={audioContentRef} className="min-w-0 px-5 pb-5">
            {audioTracks}
          </div>
        </ScrollArea>
      ) : null}
    </div>
  );
}
