import { lazyWithPreload } from "@/lib/lazy-component";

import type { ChapterManagerDialog } from "./ChapterManagerDialog";

const LazyChapterManagerDialog = lazyWithPreload<React.ComponentProps<typeof ChapterManagerDialog>>(
  () =>
    import("./ChapterManagerDialog").then((module) => ({ default: module.ChapterManagerDialog })),
);

export { LazyChapterManagerDialog };
