import { ArrowLeftFromLine, ExternalLink, RotateCcw, SquarePen, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  cancelExportAttemptRequested,
  editExportAttemptRequested,
  retryExportAttemptRequested,
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
      aria-label={t("queue.actions.cancelExport")}
      className={className}
      onClick={() =>
        void dispatch(
          cancelExportAttemptRequested({ attemptId: attempt.id, instanceId: instance.id }),
        )
      }
      size="icon-xs"
      title={t("queue.actions.cancelExport")}
      type="button"
      variant="outline"
    >
      <X aria-hidden="true" />
    </Button>
  );
}

function ExportQueueItemEdit({
  asMenuItem = false,
  className,
}: {
  asMenuItem?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { attempt, instance } = useExportQueueItem();
  const isNativeDialogOpen = useAppSelector((state) => state.importWorkflow.isNativeDialogOpen);
  const isQueued = attempt.state.status === "queued";

  const handleEdit = () =>
    void dispatch(editExportAttemptRequested({ attemptId: attempt.id, instanceId: instance.id }));

  if (asMenuItem) {
    return (
      <DropdownMenuItem disabled={isNativeDialogOpen || !isQueued} onSelect={handleEdit}>
        {t("queue.actions.editExport")}
      </DropdownMenuItem>
    );
  }

  if (!isQueued) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex" tabIndex={isNativeDialogOpen ? 0 : undefined}>
          <Button
            aria-label={t("queue.actions.editExport")}
            className={className}
            disabled={isNativeDialogOpen}
            onClick={handleEdit}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <SquarePen aria-hidden="true" />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{t("queue.actions.editExport")}</TooltipContent>
    </Tooltip>
  );
}

function ExportQueueItemRestore({
  asMenuItem = false,
  className,
}: {
  asMenuItem?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { attempt, instance } = useExportQueueItem();

  const status = attempt.state.status;
  const canRestore =
    instance.sourceAvailability === "available" &&
    (status === "completed" || status === "failed" || status === "canceled");

  if (!canRestore) return null;

  const handleRestore = () =>
    void dispatch(
      restoreExportAttemptRequested({ attemptId: attempt.id, instanceId: instance.id }),
    );

  if (asMenuItem) {
    return (
      <DropdownMenuItem onSelect={handleRestore}>{t("queue.actions.restoreEdit")}</DropdownMenuItem>
    );
  }

  return (
    <Button
      aria-label={t("queue.actions.restoreEdit")}
      className={className}
      onClick={handleRestore}
      size="icon-xs"
      title={t("queue.actions.restoreEdit")}
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
          retryExportAttemptRequested({ attemptId: attempt.id, instanceId: instance.id }),
        )
      }
      size="xs"
      type="button"
      variant="outline"
    >
      <RotateCcw aria-hidden="true" />
      {t("queue.actions.retryExport")}
    </Button>
  );
}

export {
  ExportQueueItemCancel,
  ExportQueueItemEdit,
  ExportQueueItemRestore,
  ExportQueueItemRetry,
  ExportQueueItemReveal,
};
