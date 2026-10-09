import { CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

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
  const localizedError = error ? localizeAppError(error, t) : undefined;

  const badge = (
    <Badge
      aria-label={
        localizedError ? t("queue.metrics.error", { message: localizedError }) : undefined
      }
      className={cn(status === "rendering" && "bg-primary/20 text-primary")}
      tabIndex={error ? 0 : undefined}
      variant={statusVariants[status]}
    >
      {error ? <CircleAlert aria-hidden="true" /> : null}
      {statusLabels[status]}
    </Badge>
  );

  return (
    <div className="flex shrink-0 items-center gap-1">
      {error && localizedError ? (
        <HoverCard closeDelay={100} openDelay={0} preserveOnTrigger>
          <HoverCardTrigger asChild>{badge}</HoverCardTrigger>
          <HoverCardContent
            align="end"
            className="max-h-64 w-80 max-w-[calc(100vw-2rem)] overflow-auto"
          >
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>{localizedError}</AlertTitle>
              {error.diagnostics ? (
                <AlertDescription>
                  <p className="font-medium">{t("source.technicalDetails")}</p>
                  <pre className="mt-1 text-xs wrap-break-word whitespace-pre-wrap">
                    {error.diagnostics}
                  </pre>
                </AlertDescription>
              ) : null}
            </Alert>
          </HoverCardContent>
        </HoverCard>
      ) : (
        badge
      )}
    </div>
  );
}

export { ExportQueueItemStatus };
