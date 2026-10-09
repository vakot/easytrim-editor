import { Fragment, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { cn } from "@/lib/class-names.utils";

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
          t("queue.metrics.durationTooltip"),
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
  const content = (
    <span
      aria-label={metric.ariaLabel}
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 py-1 tabular-nums",
        metric.className,
      )}
    >
      {metric.value}
      {Icon ? <Icon aria-hidden="true" className="size-3" /> : null}
    </span>
  );

  if (!metric.tooltip) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="top">{metric.tooltip}</TooltipContent>
    </Tooltip>
  );
}

function withTooltip(
  metric: ExportQueueItemMetricConfig | null,
  tooltip: string,
): ExportQueueItemMetricConfig | null {
  return metric ? { ...metric, tooltip } : null;
}

export { ExportQueueItemMetrics };
