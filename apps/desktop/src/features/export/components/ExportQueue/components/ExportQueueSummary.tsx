import { useTranslation } from "react-i18next";

import { useExportQueue } from "../contexts/ExportQueueContext";

function ExportQueueSummary() {
  const { t } = useTranslation();
  const { summary } = useExportQueue();

  const parts = [
    t("queue.summary.jobs", { count: summary.total }),
    summary.rendering > 0 ? t("queue.summary.processing", { count: summary.rendering }) : null,
    summary.queued > 0 ? t("queue.summary.queued", { count: summary.queued }) : null,
    summary.failed > 0 ? t("queue.summary.failed", { count: summary.failed }) : null,
    summary.canceled > 0 ? t("queue.summary.canceled", { count: summary.canceled }) : null,
    summary.completed > 0 ? t("queue.summary.completed", { count: summary.completed }) : null,
  ].filter((part): part is string => part !== null);

  return <>{parts.join(" · ")}</>;
}

export { ExportQueueSummary };
