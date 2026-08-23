import type { ReactNode } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { TrimRange } from "@/domain/trim";
import { timelineGeometryStyle } from "@/features/timeline/utils/timeline-geometry";

interface TimelinePaneProps {
  range: TrimRange;
  timeline: ReactNode;
  webcamTrack: ReactNode | null;
  audioTracks: ReactNode | null;
}

export function TimelinePane({ range, timeline, webcamTrack, audioTracks }: TimelinePaneProps) {
  return (
    <div
      data-slot="timeline-pane"
      style={timelineGeometryStyle(range)}
      className="flex size-full min-h-0 min-w-0 flex-col overflow-hidden bg-background"
    >
      <div className="min-w-0 shrink-0 px-5 py-4" data-testid="timeline-fixed-content">
        {timeline}
      </div>
      {webcamTrack ? (
        <>
          <Separator className="mx-5 shrink-0" />
          <div className="min-w-0 shrink-0 px-5 py-4" data-testid="webcam-track-section">
            {webcamTrack}
          </div>
        </>
      ) : null}
      {audioTracks ? (
        <>
          <Separator className="mx-5 shrink-0" />
          <ScrollArea
            type="auto"
            className="min-h-0 min-w-0 flex-1"
            data-testid="audio-tracks-scroll"
          >
            <div className="min-w-0 px-5 py-4">{audioTracks}</div>
          </ScrollArea>
        </>
      ) : null}
    </div>
  );
}
