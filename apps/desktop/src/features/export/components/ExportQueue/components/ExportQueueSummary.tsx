import { useTranslation } from "react-i18next";

import { useExportQueue } from "../contexts/ExportQueueContext";

function ExportQueueSummary() {
  const { t } = useTranslation();
  const { summary } = useExportQueue();

  const parts = [
    t("queue.summary.processing", { count: summary.rendering }),
    t("queue.summary.queued", { count: summary.queued }),
    t("queue.summary.failed", { count: summary.failed }),
    t("queue.summary.canceled", { count: summary.canceled }),
    t("queue.summary.completed", { count: summary.completed }),
  ];

  return <>{parts.join(" · ")}</>;
}

export { ExportQueueSummary };
