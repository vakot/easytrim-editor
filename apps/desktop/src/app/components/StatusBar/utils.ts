import type { ExportQueueItem } from "@/app/store/slices/export-slice";

export function splitFilePath(path: string) {
  const separatorIndex = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (separatorIndex < 0) return { directory: "", filename: path };

  return {
    directory: path.slice(0, separatorIndex + 1),
    filename: path.slice(separatorIndex + 1),
  };
}

export function selectStatusBarExport(queue: ExportQueueItem[]) {
  return [...queue].reverse().find((item) => item.status === "rendering");
}
