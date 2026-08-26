import type { ImportedQueueItem } from "@/app/store/slices/export-slice";

export function getReplacementImportedItem(
  items: ImportedQueueItem[],
  currentIndex: number,
): ImportedQueueItem | null {
  return items[currentIndex + 1] ?? items[currentIndex - 1] ?? null;
}
