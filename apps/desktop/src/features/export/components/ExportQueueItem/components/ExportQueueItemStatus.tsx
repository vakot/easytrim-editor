import { CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";

import { localizeAppError } from "@/i18n/app-errors";
import { cn } from "@/lib/class-names.utils";

import { useExportQueueItem } from "../contexts/ExportQueueItemContext";

function ExportQueueItemStatus() {
  const { t } = useTranslation();
  const { attempt } = useExportQueueItem();

  const status = attempt.state.status;
  const statusVariants = {
    canceled: "secondary",
    completed: "success",
    failed: "destructive",
    queued: "outline",
    rendering: "default",
  } as const;

  const statusLabels = {
    canceled: t("queue.jobStatus.canceled"),
    completed: t("queue.jobStatus.completed"),
    failed: t("queue.jobStatus.failed"),
    queued: t("queue.jobStatus.queued"),
    rendering: t("queue.jobStatus.processing"),
  } satisfies Record<typeof status, string>;

  const error = status === "failed" ? attempt.state.error : undefined;

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Badge
        aria-label={
          error ? t("queue.metrics.error", { message: localizeAppError(error, t) }) : undefined
        }
        className={cn(status === "rendering" && "bg-primary/20 text-primary")}
        title={error ? localizeAppError(error, t) : undefined}
        variant={statusVariants[status]}
      >
        {error ? <CircleAlert aria-hidden="true" /> : null}
        {statusLabels[status]}
      </Badge>
    </div>
  );
}

export { ExportQueueItemStatus };
