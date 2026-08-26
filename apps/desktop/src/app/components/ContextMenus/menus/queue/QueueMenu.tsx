import { CircleStop, LogOut, Moon, Power } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  queueFinishActionChanged,
  selectAvailableQueueFinishActions,
  selectExportQueue,
  selectQueueFinishAction,
  selectQueueStarted,
} from "@/app/store/slices/export-slice";
import {
  cancelActiveExportRequested,
  cancelAllExportsRequested,
  startExportQueue,
} from "@/app/store/thunks/export-thunks";
import { Button } from "@/components/ui/button";
import { ContextMenu, type ContextMenuOption } from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { QueueFinishAction } from "@/lib/tauri/queue";

import type { MenuNavigation } from "../../types";

export function QueueMenu({ navigation }: { navigation: MenuNavigation }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [isCancelQueueConfirmOpen, setIsCancelQueueConfirmOpen] = useState(false);
  const queue = useAppSelector(selectExportQueue);
  const queueStarted = useAppSelector(selectQueueStarted);
  const queueFinishAction = useAppSelector(selectQueueFinishAction);
  const availableQueueFinishActions = useAppSelector(selectAvailableQueueFinishActions);
  const hasQueuedItems = queue.some((toast) => toast.status === "queued");
  const hasActiveItem = queue.some((toast) => toast.status === "rendering");
  const queueFinishLabels: Record<QueueFinishAction, string> = {
    exit: t("app.queue.finish.exit"),
    systemSleep: t("app.queue.finish.systemSleep"),
    systemShutdown: t("app.queue.finish.systemShutdown"),
    nothing: t("app.queue.finish.nothing"),
  };

  const queueFinishIcons: Record<QueueFinishAction, ReactNode> = {
    exit: <LogOut className="size-3" aria-hidden="true" />,
    systemSleep: <Moon className="size-3" aria-hidden="true" />,
    systemShutdown: <Power className="size-3" aria-hidden="true" />,
    nothing: <CircleStop className="size-3" aria-hidden="true" />,
  };

  const queueFinishOptions: ContextMenuOption[] = availableQueueFinishActions.map((action) => ({
    id: `queue-finish-${action}`,
    children: queueFinishLabels[action],
    icon: queueFinishIcons[action],
    selected: action === queueFinishAction,
    shouldCloseOnClick: false,
    onSelect: () => dispatch(queueFinishActionChanged(action)),
  }));

  return (
    <>
      <ContextMenu
        {...navigation}
        options={[
          {
            id: "start-queue",
            children: t("app.queue.start"),
            ariaKeyShortcuts: "Enter",
            suffix: "Enter",
            disabled: !hasQueuedItems || queueStarted,
            onSelect: () => void dispatch(startExportQueue()),
          },
          { id: "queue-start-divider", separator: true },
          {
            id: "cancel-active-queue-item",
            children: t("app.queue.skip"),
            disabled: !hasActiveItem,
            onSelect: () => void dispatch(cancelActiveExportRequested()),
          },
          {
            id: "cancel-queue",
            children: t("app.queue.cancel"),
            disabled: !hasQueuedItems && !hasActiveItem,
            onSelect: () => setIsCancelQueueConfirmOpen(true),
          },
          { id: "queue-finish-divider", separator: true },
          {
            id: "queue-finish",
            children: t("app.queue.onFinish"),
            icon: queueFinishIcons[queueFinishAction],
            shouldCloseOnClick: false,
            options: queueFinishOptions,
          },
        ]}
      >
        {t("app.topBarMenus.queue")}
      </ContextMenu>
      <Dialog open={isCancelQueueConfirmOpen} onOpenChange={setIsCancelQueueConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("app.queue.cancelQueueTitle")}</DialogTitle>
            <DialogDescription>{t("app.queue.cancelQueueDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCancelQueueConfirmOpen(false)}>
              {t("common.back")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setIsCancelQueueConfirmOpen(false);
                void dispatch(cancelAllExportsRequested());
              }}
            >
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
