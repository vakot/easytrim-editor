import type { importQueueItem } from "@/app/store/slices/export-slice";

export function getReplacementImportedItem(
  items: importQueueItem[],
  currentIndex: number,
): importQueueItem | null {
  return items[currentIndex + 1] ?? items[currentIndex - 1] ?? null;
}
