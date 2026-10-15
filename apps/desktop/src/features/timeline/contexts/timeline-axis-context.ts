import { createContext, useContext } from "react";

/** Reports the selection the timeline draws, as percentages of its axis. */
type PublishTimelineSelection = (startPercent: number, endPercent: number) => void;

const TimelineAxisContext = createContext<PublishTimelineSelection | null>(null);

/** The selection publisher of the enclosing `TimelineAxisScope`, if any. */
function usePublishTimelineSelection(): PublishTimelineSelection | null {
  return useContext(TimelineAxisContext);
}

export { TimelineAxisContext, usePublishTimelineSelection };
