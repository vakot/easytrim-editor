import { useTranslation } from "react-i18next";

import { useExportQueue } from "../contexts/ExportQueueContext";

function ExportQueueSummary() {
  const { t } = useTranslation();
  const { summary } = useExportQueue();

  const parts = [
    t("queue.messages.summary.jobs", { count: summary.total }),
    summary.rendering > 0
      ? t("queue.messages.summary.rendering", { count: summary.rendering })
      : null,
    summary.queued > 0 ? t("queue.messages.summary.queued", { count: summary.queued }) : null,
    summary.failed > 0 ? t("queue.messages.summary.failed", { count: summary.failed }) : null,
    summary.canceled > 0 ? t("queue.messages.summary.canceled", { count: summary.canceled }) : null,
    summary.completed > 0
      ? t("queue.messages.summary.completed", { count: summary.completed })
      : null,
  ].filter((part): part is string => part !== null);

  return <>{parts.join(" · ")}</>;
}

export { ExportQueueSummary };
