import { lazyWithPreload } from "@/lib/lazy-component";

const LazyAppSettingsDialogContent = lazyWithPreload<Record<string, never>>(() =>
  import("./AppSettingsDialogContent").then((module) => ({
    default: module.AppSettingsDialogContent,
  })),
);

function preloadAppSettingsDialog() {
  return LazyAppSettingsDialogContent.preload();
}

export { LazyAppSettingsDialogContent, preloadAppSettingsDialog };
