import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { useAppDispatch } from "@/app/store/redux-hooks";
import { startExportQueue } from "@/app/store/thunks/export-thunks";

import { useExportQueue } from "../contexts/ExportQueueContext";

function ExportQueueActions() {
  const { t } = useTranslation();
  const { queue } = useExportQueue();

  const dispatch = useAppDispatch();

  const hasQueued = queue.some(({ attempt }) => attempt.state.status === "queued");

  return (
    <Button
      className="w-full"
      disabled={!hasQueued}
      onClick={() => void dispatch(startExportQueue())}
      size="sm"
    >
      {t("queue.actions.start")}
    </Button>
  );
}

export { ExportQueueActions };
