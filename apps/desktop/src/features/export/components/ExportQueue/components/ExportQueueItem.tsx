import { ExternalLink, RotateCcw, X } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectExportQueueById } from "@/app/store/slices/editing-instances-slice";
import {
  cancelExportAttemptRequested,
  requeueExportAttemptRequested,
} from "@/app/store/thunks/export-thunks";
import { restoreExportAttemptRequested } from "@/app/store/thunks/source-media-thunks";
import { formatBytes, formatDuration, formatSourcePath } from "@/features/source";
import { openFileLocation } from "@/lib/tauri/media";

function ExportQueueItem({ attemptId, instanceId }: { attemptId: string; instanceId: string }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const item = useAppSelector((state) =>
    selectExportQueueById(state, instanceId).find(({ attempt }) => attempt.id === attemptId),
  );

  const metrics = useMemo(() => {
    if (!item) return "";
    const { attempt } = item;

    const values: string[] = [];
    if (attempt.metrics.durationMs !== null && attempt.metrics.durationMs !== undefined) {
      values.push(formatDuration(attempt.metrics.durationMs * 1_000));
    }
    if (attempt.metrics.fileSizeBytes !== undefined) {
      values.push(formatBytes(attempt.metrics.fileSizeBytes, t("common.status.unknown")));
    }
    if (attempt.metrics.fps !== undefined) values.push(`${attempt.metrics.fps.toFixed(1)} fps`);
    return values.join(" · ");
  }, [item, t]);

  if (!item) return null;

  const { attempt, instance } = item;
  const status = attempt.state.status;
  const statusLabels = {
    canceled: t("queue.status.canceled"),
    completed: t("queue.status.completed"),
    failed: t("queue.status.failed"),
    queued: t("queue.status.queued"),
    rendering: t("queue.status.rendering"),
  } satisfies Record<typeof status, string>;

  const statusLabel = statusLabels[status];
  const source = instance.snapshot.source;
  const routeLabel =
    attempt.route === "fast" ? t("queue.labels.routeFastCut") : t("queue.labels.routeOptimized");

  const canRestore =
    instance.sourceAvailability === "available" &&
    (status === "completed" || status === "failed" || status === "canceled");

  const outputPath = attempt.state.status === "completed" ? attempt.state.result.displayPath : null;

  return (
    <li className="rounded-lg border border-foreground/10 bg-card p-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium" title={attempt.output.displayPath}>
            {attempt.output.displayName}
          </p>
          <p className="truncate text-muted-foreground" title={source.sourcePath}>
            {source.displayName}
          </p>
          <p className="truncate text-muted-foreground/70" title={source.sourcePath}>
            {formatSourcePath(source.sourcePath)}
          </p>
        </div>
        <Badge size="xs" variant={status === "failed" ? "destructive" : "outline"}>
          {statusLabel}
        </Badge>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-muted-foreground">
        <span>{routeLabel}</span>
        {metrics ? <span className="truncate">{metrics}</span> : null}
      </div>

      {status === "rendering" ? (
        <div className="mt-2 flex items-center gap-2">
          <Progress
            aria-label={t("queue.accessibility.progress")}
            value={attempt.metrics.progressPercent}
          />
          <span className="w-10 text-right tabular-nums">
            {Math.round(attempt.metrics.progressPercent)}%
          </span>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-1">
        {status === "queued" || status === "rendering" ? (
          <Button
            aria-label={t("queue.actions.cancel")}
            onClick={() =>
              void dispatch(
                cancelExportAttemptRequested({ attemptId: attempt.id, instanceId: instance.id }),
              )
            }
            size="icon-xs"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        ) : null}
        {status === "rendering" ? (
          <Button
            onClick={() =>
              void dispatch(
                requeueExportAttemptRequested({ attemptId: attempt.id, instanceId: instance.id }),
              )
            }
            size="xs"
            variant="ghost"
          >
            <RotateCcw aria-hidden="true" />
            {t("queue.actions.retry")}
          </Button>
        ) : null}
        {outputPath ? (
          <Button
            onClick={() => void openFileLocation(outputPath).catch(() => undefined)}
            size="xs"
            variant="outline"
          >
            <ExternalLink aria-hidden="true" />
            {t("queue.actions.revealOutput")}
          </Button>
        ) : null}
        {canRestore ? (
          <Button
            onClick={() =>
              void dispatch(
                restoreExportAttemptRequested({ attemptId: attempt.id, instanceId: instance.id }),
              )
            }
            size="xs"
            variant="ghost"
          >
            <RotateCcw aria-hidden="true" />
            {t("queue.actions.restore")}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export { ExportQueueItem };
