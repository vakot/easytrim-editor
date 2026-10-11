import { lazyWithPreload } from "@/lib/lazy-component";

const LazySettingsDialog = lazyWithPreload<Record<string, never>>(() =>
  import("./SettingsDialog").then((module) => ({ default: module.SettingsDialog })),
);

function preloadSettingsDialog() {
  return LazySettingsDialog.preload();
}

export { LazySettingsDialog, preloadSettingsDialog };
