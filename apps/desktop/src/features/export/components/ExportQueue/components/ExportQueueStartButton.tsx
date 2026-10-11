import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { useAppDispatch } from "@/app/store/redux-hooks";
import { startExportQueue } from "@/app/store/thunks/export-thunks";

import { useExportQueue } from "../contexts/ExportQueueContext";

function ExportQueueStartButton() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { summary } = useExportQueue();

  return (
    <Button
      disabled={summary.queued === 0}
      onClick={() => void dispatch(startExportQueue())}
      type="button"
    >
      {t("queue.actions.startQueue")}
    </Button>
  );
}

export { ExportQueueStartButton };
