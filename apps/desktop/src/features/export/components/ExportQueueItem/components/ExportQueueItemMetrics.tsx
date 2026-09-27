import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Fragment, type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatExportDuration, formatExportFileSize } from "@/domain/export-metrics";

import { useExportQueueItem } from "../contexts/ExportQueueItemContext";

function ExportQueueItemMetrics() {
  const { t } = useTranslation();
  const { attempt } = useExportQueueItem();
  const status = attempt.state.status;

  const metrics = useMemo(() => {
    const values: ReactNode[] = [];
    const durationMs = attempt.metrics.durationMs;

    if (durationMs !== null && durationMs !== undefined) {
      const duration = formatExportDuration(durationMs);
      values.push(
        <QueueMetricTooltip
          key="duration"
          label={t("queue.tooltips.duration")}
        >
          {status === "rendering" ? t("queue.messages.elapsed", { value: duration }) : duration}
        </QueueMetricTooltip>,
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
        values.push(
          <QueueMetricTooltip key="remaining" label={t("queue.tooltips.remaining")}>
            {t("queue.messages.remaining", { value: formatExportDuration(remainingMs) })}
          </QueueMetricTooltip>,
        );
      }
    }

    if (attempt.metrics.fileSizeBytes !== undefined) {
      values.push(
        <QueueMetricTooltip key="file-size" label={t("queue.tooltips.fileSize")}>
          {formatExportFileSize(attempt.metrics.fileSizeBytes)}
        </QueueMetricTooltip>,
      );
    }
    if (attempt.metrics.fps !== undefined) {
      values.push(
        <QueueMetricTooltip key="fps" label={t("queue.tooltips.fps")}>
          {t("queue.messages.fps", { value: attempt.metrics.fps.toFixed(1) })}
        </QueueMetricTooltip>,
      );
    }

    const sourceSizeBytes = attempt.snapshot.source.fileSizeBytes;
    const outputSizeBytes = attempt.metrics.fileSizeBytes;
    const canShowFileSizeChange =
      status === "completed" &&
      sourceSizeBytes !== undefined &&
      sourceSizeBytes > 0 &&
      outputSizeBytes !== undefined;

    if (canShowFileSizeChange) {
      const percentChange = Math.round(
        ((outputSizeBytes - sourceSizeBytes) / sourceSizeBytes) * 100,
      );

      const direction = percentChange < 0 ? "down" : percentChange > 0 ? "up" : "same";
      const sizeDifference = formatExportFileSize(Math.abs(outputSizeBytes - sourceSizeBytes));
      const value = `${percentChange > 0 ? "+" : ""}${percentChange}% (${sizeDifference})`;
      const Icon = direction === "down" ? ArrowDown : direction === "up" ? ArrowUp : Minus;
      const colorClass =
        direction === "down"
          ? "text-green-500"
          : direction === "up"
            ? "text-destructive"
            : "text-muted-foreground";

      values.push(
        <QueueMetricTooltip key="file-size-change" label={t("queue.tooltips.fileSizeChange")}>
          <span
            aria-label={t("queue.messages.fileSizeChange", { value })}
            className={`inline-flex items-center gap-0.5 ${colorClass}`}
          >
            {value}
            <Icon aria-hidden="true" className="size-3" />
          </span>
        </QueueMetricTooltip>,
      );
    }
    return values;
  }, [attempt, status, t]);

  if (!metrics.length) return null;

  const hasProgress =
    status === "rendering" || status === "completed" || attempt.metrics.progressPercent > 0;

  return (
    <span className="min-w-0 truncate">
      {hasProgress ? "· " : null}
      {metrics.map((metric, index) => (
        <Fragment key={index}>
          {index > 0 ? " · " : null}
          {metric}
        </Fragment>
      ))}
    </span>
  );
}

function QueueMetricTooltip({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="shrink-0 py-1 tabular-nums">{children}</span>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export { ExportQueueItemMetrics };
