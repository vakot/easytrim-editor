import type { ImportQueueItem } from "@/app/store/slices/export-slice";

export function getReplacementImportedItem(
  items: ImportQueueItem[],
  currentIndex: number,
): ImportQueueItem | null {
  return items[currentIndex + 1] ?? items[currentIndex - 1] ?? null;
}
