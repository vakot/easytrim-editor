import type { ComponentType } from "react";

import type { AudioFilter, AudioSyncOffset, AudioSyncOffsetRange } from "@/domain/audio-processing";

import { AUDIO_FILTER_PAGES, AUDIO_SYNC_OFFSET_PAGE } from "../lib/audio-filter-pages";
import { AUDIO_SYNC_OFFSET_ID } from "../lib/audio-filters-draft";

/** The page of a filter instance's type, loaded when first shown and reused afterwards. */
function AudioFilterPage({
  filter,
  syncOffsetRange,
}: {
  filter: AudioFilter | (AudioSyncOffset & { id: string });
  syncOffsetRange: AudioSyncOffsetRange;
}) {
  if (filter.id === AUDIO_SYNC_OFFSET_ID) {
    return <AUDIO_SYNC_OFFSET_PAGE offset={filter as AudioSyncOffset} range={syncOffsetRange} />;
  }
  const Page = AUDIO_FILTER_PAGES[(filter as AudioFilter).type] as ComponentType<{
    filter: AudioFilter;
  }>;

  return <Page filter={filter as AudioFilter} />;
}

export { AudioFilterPage };
