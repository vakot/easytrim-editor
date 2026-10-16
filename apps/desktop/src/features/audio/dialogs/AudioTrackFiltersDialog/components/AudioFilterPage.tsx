import type { ComponentType } from "react";

import type { AudioFilter } from "@/domain/audio-processing";

import { AUDIO_FILTER_PAGES } from "../lib/audio-filter-pages";

/** The page of a filter instance's type, loaded when first shown and reused afterwards. */
function AudioFilterPage({ filter }: { filter: AudioFilter }) {
  const Page = AUDIO_FILTER_PAGES[filter.type] as ComponentType<{ filter: AudioFilter }>;

  return <Page filter={filter} />;
}

export { AudioFilterPage };
