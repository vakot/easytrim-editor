import { lazyWithPreload, preloadOnIntent } from "@easytrim-editor/ui/lazy-component";

const LazyAudioPanel = lazyWithPreload<Record<string, never>>(() =>
  import("./components/AudioPanel").then((module) => ({ default: module.AudioPanel })),
);

const preloadAudioPanel = preloadOnIntent(() => LazyAudioPanel.preload());

export { LazyAudioPanel, preloadAudioPanel };
