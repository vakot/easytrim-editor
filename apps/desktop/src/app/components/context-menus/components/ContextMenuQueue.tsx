import { CircleStop, LogOut, Moon, Power } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "@/components/ui/menu";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
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
import type { QueueFinishAction } from "@/lib/tauri/queue.types";

import type { MenuNavigation } from "../types";

export function ContextMenuQueue({ navigation }: { navigation: MenuNavigation }) {
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
    exit: <LogOut aria-hidden="true" className="size-3" />,
    systemSleep: <Moon aria-hidden="true" className="size-3" />,
    systemShutdown: <Power aria-hidden="true" className="size-3" />,
    nothing: <CircleStop aria-hidden="true" className="size-3" />,
  };

  return (
    <>
      <Menu modal={false} onOpenChange={navigation.onOpenChange} open={navigation.open}>
        <MenuTrigger
          asChild
          onPointerEnter={navigation.onTriggerPointerEnter}
          onPointerLeave={navigation.onTriggerPointerLeave}
        >
          <Button
            className="text-foreground/80 data-[state=open]:bg-accent data-[state=open]:text-foreground"
            size="xs"
            type="button"
            variant="ghost"
          >
            {t("app.topBarMenus.queue")}
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem
            aria-keyshortcuts="Enter"
            disabled={!hasQueuedItems || queueStarted}
            onSelect={() => void dispatch(startExportQueue())}
            suffix="Enter"
          >
            {t("app.queue.start")}
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            disabled={!hasActiveItem}
            onSelect={() => void dispatch(cancelActiveExportRequested())}
          >
            {t("app.queue.skip")}
          </MenuItem>
          <MenuItem
            disabled={!hasQueuedItems && !hasActiveItem}
            onSelect={() => setIsCancelQueueConfirmOpen(true)}
          >
            {t("app.queue.cancel")}
          </MenuItem>
          <MenuSeparator />
          <MenuSub>
            <MenuSubTrigger icon={queueFinishIcons[queueFinishAction]}>
              {t("app.queue.onFinish")}
            </MenuSubTrigger>
            <MenuSubContent>
              {availableQueueFinishActions.map((action) => (
                <MenuItem
                  icon={queueFinishIcons[action]}
                  key={action}
                  onSelect={(event) => {
                    event.preventDefault();
                    dispatch(queueFinishActionChanged(action));
                  }}
                  selected={action === queueFinishAction}
                >
                  {queueFinishLabels[action]}
                </MenuItem>
              ))}
            </MenuSubContent>
          </MenuSub>
        </MenuContent>
      </Menu>
      <Dialog onOpenChange={setIsCancelQueueConfirmOpen} open={isCancelQueueConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("app.queue.cancelQueueTitle")}</DialogTitle>
            <DialogDescription>{t("app.queue.cancelQueueDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setIsCancelQueueConfirmOpen(false)} variant="outline">
              {t("common.back")}
            </Button>
            <Button
              onClick={() => {
                setIsCancelQueueConfirmOpen(false);
                void dispatch(cancelAllExportsRequested());
              }}
              variant="destructive"
            >
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
