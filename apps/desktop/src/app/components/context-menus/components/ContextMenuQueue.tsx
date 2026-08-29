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
  MenuGroup,
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
    exit: t("queue.options.finish.exit"),
    systemSleep: t("queue.options.finish.systemSleep"),
    systemShutdown: t("queue.options.finish.systemShutdown"),
    nothing: t("queue.options.finish.nothing"),
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
            {t("queue.labels.title")}
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuGroup>
            <MenuItem
              aria-keyshortcuts="Enter"
              disabled={!hasQueuedItems || queueStarted}
              onSelect={() => void dispatch(startExportQueue())}
              suffix="Enter"
            >
              {t("queue.actions.start")}
            </MenuItem>
          </MenuGroup>
          <MenuSeparator />
          <MenuGroup>
            <MenuItem
              disabled={!hasActiveItem}
              onSelect={() => void dispatch(cancelActiveExportRequested())}
            >
              {t("queue.actions.skip")}
            </MenuItem>
            <MenuItem
              disabled={!hasQueuedItems && !hasActiveItem}
              onSelect={() => setIsCancelQueueConfirmOpen(true)}
            >
              {t("queue.actions.cancel")}
            </MenuItem>
          </MenuGroup>
          <MenuSeparator />
          <MenuGroup>
            <MenuSub>
              <MenuSubTrigger icon={queueFinishIcons[queueFinishAction]}>
                {t("queue.labels.onFinish")}
              </MenuSubTrigger>
              <MenuSubContent>
                <MenuGroup>
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
                </MenuGroup>
              </MenuSubContent>
            </MenuSub>
          </MenuGroup>
        </MenuContent>
      </Menu>
      <Dialog onOpenChange={setIsCancelQueueConfirmOpen} open={isCancelQueueConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("queue.dialogs.cancel.title")}</DialogTitle>
            <DialogDescription>{t("queue.dialogs.cancel.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setIsCancelQueueConfirmOpen(false)} variant="outline">
              {t("common.actions.back")}
            </Button>
            <Button
              onClick={() => {
                setIsCancelQueueConfirmOpen(false);
                void dispatch(cancelAllExportsRequested());
              }}
              variant="destructive"
            >
              {t("queue.actions.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
