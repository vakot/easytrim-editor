import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { formatBytes, formatDuration } from "@/features/source";

import { useExportQueueItem } from "../contexts/ExportQueueItemContext";

function ExportQueueItemMetrics() {
  const { t } = useTranslation();
  const { attempt } = useExportQueueItem();

  const metrics = useMemo(() => {
    const values: string[] = [];
    if (attempt.metrics.durationMs !== null && attempt.metrics.durationMs !== undefined) {
      values.push(formatDuration(attempt.metrics.durationMs * 1_000));
    }
    if (attempt.metrics.fileSizeBytes !== undefined) {
      values.push(formatBytes(attempt.metrics.fileSizeBytes, t("common.status.unknown")));
    }
    if (attempt.metrics.fps !== undefined) values.push(`${attempt.metrics.fps.toFixed(1)} fps`);
    return values;
  }, [attempt, t]);

  if (!metrics.length) return null;

  return metrics.flatMap((metric, index) => [
    index > 0 ? "·" : null,
    <span className="truncate" key={metric}>
      {metric}
    </span>,
  ]);
}

export { ExportQueueItemMetrics };
