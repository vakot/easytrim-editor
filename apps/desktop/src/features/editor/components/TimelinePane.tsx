import type { ReactNode } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";

interface TimelinePaneProps {
  timeline: ReactNode;
  audioTracks: ReactNode;
}

export function TimelinePane({ timeline, audioTracks }: TimelinePaneProps) {
  return (
    <div className="grid size-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-background">
      <div className="min-w-0" data-testid="timeline-fixed-content">
        {timeline}
      </div>
      <ScrollArea type="auto" className="min-h-0 min-w-0" data-testid="audio-tracks-scroll">
        <div className="min-w-0 px-5 pb-5">{audioTracks}</div>
      </ScrollArea>
    </div>
  );
}
