import { lazyWithPreload, preloadOnIntent } from "@/lib/lazy-component";

const LazyAudioPanel = lazyWithPreload<Record<string, never>>(() =>
  import("./components/AudioPanel").then((module) => ({ default: module.AudioPanel })),
);

const preloadAudioPanel = preloadOnIntent(() => LazyAudioPanel.preload());

export { LazyAudioPanel, preloadAudioPanel };
