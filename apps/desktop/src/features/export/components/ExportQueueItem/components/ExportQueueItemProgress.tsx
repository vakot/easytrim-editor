import { useTranslation } from "react-i18next";

import { Progress } from "@/components/ui/progress";

import { useExportQueueItem } from "../contexts/ExportQueueItemContext";

function ExportQueueItemProgressBar() {
  const { t } = useTranslation();
  const { attempt } = useExportQueueItem();

  return (
    <Progress
      aria-label={t("queue.accessibility.progress")}
      className="h-1.5 flex-1"
      value={attempt.metrics.progressPercent}
    />
  );
}

export { ExportQueueItemProgressBar };
