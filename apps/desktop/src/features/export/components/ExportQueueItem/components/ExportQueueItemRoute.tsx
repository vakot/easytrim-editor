import { useTranslation } from "react-i18next";

import { useExportQueueItem } from "../contexts/ExportQueueItemContext";

function ExportQueueItemRoute({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { attempt } = useExportQueueItem();

  const label = attempt.route === "fast" ? t("queue.routes.fastCut") : t("queue.routes.optimized");

  return <span className={className}>{label}</span>;
}

export { ExportQueueItemRoute };
