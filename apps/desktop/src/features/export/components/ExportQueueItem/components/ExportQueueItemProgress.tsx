import { useTranslation } from "react-i18next";

import { Progress } from "@/components/ui/progress";

import { useExportQueueItem } from "../contexts/ExportQueueItemContext";

function ExportQueueItemProgressBar() {
  const { t } = useTranslation();
  const { attempt } = useExportQueueItem();

  return (
    <Progress
      aria-label={t("queue.accessibility.progress")}
      className="h-1.5 flex-1"
      value={attempt.metrics.progressPercent}
    />
  );
}

function ExportQueueItemProgressPercent() {
  const { attempt } = useExportQueueItem();
  const status = attempt.state.status;

  if (status === "queued") return null;
  if (status !== "completed" && attempt.metrics.progressPercent <= 0) return null;

  return (
    <span className="shrink-0 tabular-nums">{Math.round(attempt.metrics.progressPercent)}%</span>
  );
}

export { ExportQueueItemProgressBar, ExportQueueItemProgressPercent };
