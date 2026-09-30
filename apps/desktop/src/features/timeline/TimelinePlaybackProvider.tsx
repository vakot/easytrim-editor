import type { ReactNode } from "react";

import { TimelinePlaybackContext } from "./contexts/timeline-playback-context";
import { useTimelinePlaybackRuntime } from "./hooks/useTimelinePlaybackRuntime";

function TimelinePlaybackProvider({ children }: { children: ReactNode }) {
  const runtime = useTimelinePlaybackRuntime();
  return (
    <TimelinePlaybackContext.Provider value={runtime}>{children}</TimelinePlaybackContext.Provider>
  );
}

export { TimelinePlaybackProvider };
