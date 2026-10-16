import type { AudioFilter, AudioFilterType } from "@/domain/audio-processing";
import { lazyWithPreload } from "@/lib/lazy-component";

type AudioFilterPageProps<T extends AudioFilterType> = {
  filter: Extract<AudioFilter, { type: T }>;
};

/**
 * The page of each filter type, loaded the first time that type is shown. Every page is its own
 * dynamic import, so no page is part of the dialog's own code, and a loaded module serves every
 * instance of its type.
 */
const AUDIO_FILTER_PAGES = {
  gain: lazyWithPreload<AudioFilterPageProps<"gain">>(() =>
    import("../pages/GainFilterPage").then((module) => ({ default: module.GainFilterPage })),
  ),
  highPass: lazyWithPreload<AudioFilterPageProps<"highPass">>(() =>
    import("../pages/HighPassFilterPage").then((module) => ({
      default: module.HighPassFilterPage,
    })),
  ),
  limiter: lazyWithPreload<AudioFilterPageProps<"limiter">>(() =>
    import("../pages/LimiterFilterPage").then((module) => ({
      default: module.LimiterFilterPage,
    })),
  ),
  loudnessNormalization: lazyWithPreload<AudioFilterPageProps<"loudnessNormalization">>(() =>
    import("../pages/LoudnessNormalizationFilterPage").then((module) => ({
      default: module.LoudnessNormalizationFilterPage,
    })),
  ),
  noiseReduction: lazyWithPreload<AudioFilterPageProps<"noiseReduction">>(() =>
    import("../pages/NoiseReductionFilterPage").then((module) => ({
      default: module.NoiseReductionFilterPage,
    })),
  ),
} satisfies { [T in AudioFilterType]: unknown };

function preloadAudioFilterPage(type: AudioFilterType): void {
  void AUDIO_FILTER_PAGES[type].preload().catch(() => undefined);
}

export { AUDIO_FILTER_PAGES, preloadAudioFilterPage };
