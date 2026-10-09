import { useTranslation } from "react-i18next";

import { Progress } from "@/components/ui/progress";

import { getExportMetricValues } from "@/domain/export-metrics";

import { useExportQueueItem } from "../contexts/ExportQueueItemContext";

function ExportQueueItemProgressBar() {
  const { t } = useTranslation();
  const { attempt } = useExportQueueItem();
  const metrics = getExportMetricValues(attempt);

  return (
    <Progress
      aria-label={t("queue.progress.accessibleLabel")}
      className="h-1.5 flex-1"
      indeterminate={metrics.indeterminate}
      value={metrics.progressPercent ?? 0}
    />
  );
}

export { ExportQueueItemProgressBar };
