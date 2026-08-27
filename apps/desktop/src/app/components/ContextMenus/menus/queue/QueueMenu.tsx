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

  return (
    <>
      <Menu modal={false} open={navigation.open} onOpenChange={navigation.onOpenChange}>
        <MenuTrigger
          asChild
          onPointerEnter={navigation.onTriggerPointerEnter}
          onPointerLeave={navigation.onTriggerPointerLeave}
        >
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-foreground/80 data-[state=open]:bg-accent data-[state=open]:text-foreground"
          >
            {t("app.topBarMenus.queue")}
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem
            aria-keyshortcuts="Enter"
            disabled={!hasQueuedItems || queueStarted}
            suffix="Enter"
            onSelect={() => void dispatch(startExportQueue())}
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
                  key={action}
                  icon={queueFinishIcons[action]}
                  selected={action === queueFinishAction}
                  onSelect={(event) => {
                    event.preventDefault();
                    dispatch(queueFinishActionChanged(action));
                  }}
                >
                  {queueFinishLabels[action]}
                </MenuItem>
              ))}
            </MenuSubContent>
          </MenuSub>
        </MenuContent>
      </Menu>
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
