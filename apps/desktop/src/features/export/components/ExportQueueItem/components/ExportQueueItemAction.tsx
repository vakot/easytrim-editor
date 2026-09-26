import { ArrowLeftFromLine, ExternalLink, RotateCcw, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { useAppDispatch } from "@/app/store/redux-hooks";
import {
  cancelExportAttemptRequested,
  requeueExportAttemptRequested,
} from "@/app/store/thunks/export-thunks";
import { restoreExportAttemptRequested } from "@/app/store/thunks/source-media-thunks";
import { openFileLocation } from "@/lib/tauri/media";

import { useExportQueueItem } from "../contexts/ExportQueueItemContext";

function ExportQueueItemCancel({ className }: { className?: string }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { attempt, instance } = useExportQueueItem();

  const status = attempt.state.status;

  if (status !== "queued" && status !== "rendering") return null;

  return (
    <Button
      aria-label={t("queue.actions.cancel")}
      className={className}
      onClick={() =>
        void dispatch(
          cancelExportAttemptRequested({ attemptId: attempt.id, instanceId: instance.id }),
        )
      }
      size="icon-xs"
      title={t("queue.actions.cancel")}
      type="button"
      variant="outline"
    >
      <X aria-hidden="true" />
    </Button>
  );
}

function ExportQueueItemRestore({ className }: { className?: string }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { attempt, instance } = useExportQueueItem();

  const status = attempt.state.status;
  const canRestore =
    instance.sourceAvailability === "available" &&
    (status === "completed" || status === "failed" || status === "canceled");

  if (!canRestore) return null;

  return (
    <Button
      aria-label={t("queue.actions.restore")}
      className={className}
      onClick={() =>
        void dispatch(
          restoreExportAttemptRequested({ attemptId: attempt.id, instanceId: instance.id }),
        )
      }
      size="icon-xs"
      title={t("queue.actions.restore")}
      type="button"
      variant="outline"
    >
      <ArrowLeftFromLine aria-hidden="true" />
    </Button>
  );
}

function ExportQueueItemReveal({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { attempt } = useExportQueueItem();

  const outputPath = attempt.state.status === "completed" ? attempt.state.result.displayPath : null;

  if (!outputPath) return null;

  return (
    <Button
      className={className}
      onClick={() => void openFileLocation(outputPath).catch(() => undefined)}
      size="xs"
      type="button"
      variant="outline"
    >
      <ExternalLink aria-hidden="true" />
      {t("queue.actions.revealOutput")}
    </Button>
  );
}

function ExportQueueItemRetry({ className }: { className?: string }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { attempt, instance } = useExportQueueItem();

  const status = attempt.state.status;

  if (status !== "failed") return null;

  return (
    <Button
      className={className}
      onClick={() =>
        void dispatch(
          requeueExportAttemptRequested({ attemptId: attempt.id, instanceId: instance.id }),
        )
      }
      size="xs"
      type="button"
      variant="outline"
    >
      <RotateCcw aria-hidden="true" />
      {t("queue.actions.retry")}
    </Button>
  );
}

export {
  ExportQueueItemCancel,
  ExportQueueItemRestore,
  ExportQueueItemRetry,
  ExportQueueItemReveal,
};
