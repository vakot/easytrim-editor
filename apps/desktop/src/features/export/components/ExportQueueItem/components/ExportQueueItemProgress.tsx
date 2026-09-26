import { useTranslation } from "react-i18next";

import { Progress } from "@/components/ui/progress";

import { useExportQueueItem } from "../contexts/ExportQueueItemContext";

function ExportQueueItemProgress() {
  const { attempt } = useExportQueueItem();

  const status = attempt.state.status;

  if (status !== "rendering") return null;

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

  const status = attempt.state.status;

  if (status !== "rendering") return null;

  return (
    <Progress
      aria-label={t("queue.accessibility.progress")}
      value={attempt.metrics.progressPercent}
    />
  );
}

function ExportQueueItemProgressPercent() {
  const { attempt } = useExportQueueItem();

  const status = attempt.state.status;

  if (status !== "rendering") return null;

  return (
    <span className="w-10 text-right tabular-nums">
      {Math.round(attempt.metrics.progressPercent)}%
    </span>
  );
}

export { ExportQueueItemProgress, ExportQueueItemProgressBar, ExportQueueItemProgressPercent };
