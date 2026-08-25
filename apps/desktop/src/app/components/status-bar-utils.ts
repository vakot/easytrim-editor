import type { ExportToast } from "@/features/export";

export function selectStatusBarExport(queue: ExportToast[]) {
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
