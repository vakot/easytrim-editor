import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { useAppDispatch } from "@/app/store/redux-hooks";
import { startExportQueue } from "@/app/store/thunks/export-thunks";

import { useExportQueue } from "../contexts/ExportQueueContext";

function ExportQueueActions() {
  const { t } = useTranslation();
  const { summary } = useExportQueue();

  const dispatch = useAppDispatch();

  return (
    <Button
      className="w-full"
      disabled={summary.queued === 0}
      onClick={() => void dispatch(startExportQueue())}
      size="sm"
    >
      {t("queue.actions.start")}
    </Button>
  );
}

export { ExportQueueActions };
