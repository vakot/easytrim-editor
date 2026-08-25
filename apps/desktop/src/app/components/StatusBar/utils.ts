import type { ExportQueueItem } from "@/app/store/slices/export-slice";

export function selectStatusBarExport(queue: ExportQueueItem[]) {
  const renderingExport = [...queue].reverse().find((item) => item.status === "rendering");
  if (renderingExport) return renderingExport;

  return [...queue]
    .reverse()
    .find(
      (item) =>
        item.startedAt !== null &&
        (item.status === "completed" || item.status === "failed" || item.status === "canceled"),
    );
}
