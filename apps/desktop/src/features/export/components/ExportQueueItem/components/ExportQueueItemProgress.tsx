import { useTranslation } from "react-i18next";

import { Progress } from "@/components/ui/progress";

import { useExportQueueItem } from "../contexts/ExportQueueItemContext";

function ExportQueueItemProgress() {
  return (
    <div className="flex items-center gap-2">
      <ExportQueueItemProgressBar />
      <ExportQueueItemProgressPercent />
    </div>
  );
}

function ExportQueueItemProgressBar() {
  const { t } = useTranslation();
  const { attempt } = useExportQueueItem();

  return (
    <Progress
      aria-label={t("queue.accessibility.progress")}
      value={attempt.metrics.progressPercent}
    />
  );
}

function ExportQueueItemProgressPercent() {
  const { attempt } = useExportQueueItem();

  return <span>{Math.round(attempt.metrics.progressPercent)}%</span>;
}

export { ExportQueueItemProgress, ExportQueueItemProgressBar, ExportQueueItemProgressPercent };
