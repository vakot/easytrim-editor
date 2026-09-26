import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { formatExportDuration, formatExportFileSize } from "@/domain/export-metrics";

import { useExportQueueItem } from "../contexts/ExportQueueItemContext";

function ExportQueueItemMetrics() {
  const { t } = useTranslation();
  const { attempt } = useExportQueueItem();
  const status = attempt.state.status;

  const metrics = useMemo(() => {
    const values: string[] = [];
    const durationMs = attempt.metrics.durationMs;

    if (durationMs !== null && durationMs !== undefined) {
      const duration = formatExportDuration(durationMs);
      values.push(
        status === "rendering" ? t("queue.messages.elapsed", { value: duration }) : duration,
      );
    }

    if (
      status === "rendering" &&
      durationMs !== null &&
      durationMs !== undefined &&
      attempt.metrics.estimatedTotalTimeMs !== undefined
    ) {
      const remainingMs = attempt.metrics.estimatedTotalTimeMs - durationMs;
      if (remainingMs > 0) {
        values.push(t("queue.messages.remaining", { value: formatExportDuration(remainingMs) }));
      }
    }

    if (attempt.metrics.fileSizeBytes !== undefined) {
      values.push(formatExportFileSize(attempt.metrics.fileSizeBytes));
    }
    if (attempt.metrics.fps !== undefined) {
      values.push(t("queue.messages.fps", { value: attempt.metrics.fps.toFixed(1) }));
    }
    return values;
  }, [attempt, status, t]);

  if (!metrics.length) return null;

  const hasProgress =
    status === "rendering" || status === "completed" || attempt.metrics.progressPercent > 0;

  return (
    <span className="min-w-0 truncate">
      {hasProgress ? "· " : null}
      {metrics.join(" · ")}
    </span>
  );
}

export { ExportQueueItemMetrics };
