import { useTranslation } from "react-i18next";

import { Progress } from "@/components/ui/progress";

import { useExportQueueItem } from "../contexts/ExportQueueItemContext";

function ExportQueueItemProgressBar() {
  const { t } = useTranslation();
  const { attempt } = useExportQueueItem();
  const preparingPalette = attempt.metrics.phase === "preparing";

  return (
    <Progress
      aria-label={t("queue.progress.accessibleLabel")}
      aria-valuetext={preparingPalette ? t("queue.progress.preparingGifPalette") : undefined}
      className="h-1.5 flex-1"
      indeterminate={preparingPalette}
      value={attempt.metrics.progressPercent}
    />
  );
}

export { ExportQueueItemProgressBar };
