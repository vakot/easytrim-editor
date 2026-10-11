import { lazyWithPreload } from "@/lib/lazy-component";

const LazyExportDialog = lazyWithPreload<Record<string, never>>(() =>
  import("./ExportDialog").then((module) => ({ default: module.ExportDialog })),
);

function preloadExportDialog() {
  return LazyExportDialog.preload();
}

export { LazyExportDialog, preloadExportDialog };
