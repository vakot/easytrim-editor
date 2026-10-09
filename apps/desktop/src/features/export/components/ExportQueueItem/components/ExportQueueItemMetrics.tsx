import { Fragment, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { MetricTooltip } from "@/components/metric-tooltip";

import { useExportQueueItem } from "../contexts/ExportQueueItemContext";
import {
  getDuration,
  getFileSize,
  getFileSizeChange,
  getFps,
  getProgress,
} from "../lib/export-queue-item-metrics";
import type { ExportQueueItemMetricConfig } from "../types";

function ExportQueueItemMetrics() {
  const { t } = useTranslation();
  const { attempt } = useExportQueueItem();
  const status = attempt.state.status;

  const metrics = useMemo(
    () =>
      [
        withTooltip(getProgress(attempt, { status }), t("queue.progress.accessibleLabel")),
        withTooltip(
          getDuration(attempt, {
            status,
            formatValue: (value) => t("queue.metrics.elapsed", { value }),
          }),
          status === "completed"
            ? t("queue.metrics.durationTooltip")
            : t("export.estimate.timeLabel"),
        ),
        withTooltip(getFileSize(attempt, {}), t("queue.metrics.fileSizeTooltip")),
        withTooltip(
          getFps(attempt, {
            formatValue: (value) => t("queue.metrics.fps", { value }),
          }),
          t("queue.metrics.fpsTooltip"),
        ),
        withTooltip(
          getFileSizeChange(attempt, {
            status,
            formatValue: (value) => t("queue.metrics.fileSizeChange", { value }),
          }),
          t("queue.metrics.fileSizeChangeTooltip"),
        ),
      ].filter((metric): metric is ExportQueueItemMetricConfig => metric !== null),
    [attempt, status, t],
  );

  if (!metrics.length) return null;

  return (
    <span className="min-w-0 truncate">
      {metrics.map((metric, index) => (
        <Fragment key={metric.id}>
          {index > 0 ? " · " : null}
          <ExportQueueItemMetric metric={metric} />
        </Fragment>
      ))}
    </span>
  );
}

function ExportQueueItemMetric({ metric }: { metric: ExportQueueItemMetricConfig }) {
  const Icon = metric.icon;
  return (
    <MetricTooltip
      ariaLabel={metric.ariaLabel}
      className={metric.className}
      label={metric.tooltip ?? ""}
    >
      {metric.value}
      {Icon ? <Icon aria-hidden="true" className="size-3" /> : null}
    </MetricTooltip>
  );
}

function withTooltip(
  metric: ExportQueueItemMetricConfig | null,
  tooltip: string,
): ExportQueueItemMetricConfig | null {
  return metric ? { ...metric, tooltip } : null;
}

export { ExportQueueItemMetrics };
