import { lazyWithPreload } from "@/lib/lazy-component";

import type { CommandPaletteDialogProps } from "./CommandPaletteDialog";

const LazyCommandPaletteDialog = lazyWithPreload<CommandPaletteDialogProps>(() =>
  import("./CommandPaletteDialog").then((module) => ({ default: module.CommandPaletteDialog })),
);

function preloadCommandPalette() {
  return LazyCommandPaletteDialog.preload();
}

export { LazyCommandPaletteDialog, preloadCommandPalette };
