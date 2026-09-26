import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";

import { useExportQueueItem } from "../contexts/ExportQueueItemContext";

function ExportQueueItemStatus() {
  const { t } = useTranslation();
  const { attempt } = useExportQueueItem();

  const status = attempt.state.status;
  const statusLabels = {
    canceled: t("queue.status.canceled"),
    completed: t("queue.status.completed"),
    failed: t("queue.status.failed"),
    queued: t("queue.status.queued"),
    rendering: t("queue.status.rendering"),
  } satisfies Record<typeof status, string>;

  return (
    <Badge variant={status === "failed" ? "destructive" : "outline"}>{statusLabels[status]}</Badge>
  );
}

export { ExportQueueItemStatus };
