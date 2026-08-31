import { CircleStop, LogOut, Moon, Power } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarIcon,
  MenubarItem,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  queueFinishActionChanged,
  selectAvailableQueueFinishActions,
  selectExportQueue,
  selectQueueFinishAction,
  selectQueueStarted,
} from "@/app/store/slices/export-slice";
import {
  preferenceChanged,
  selectDeleteSourceOnRenderFinish,
} from "@/app/store/slices/preferences-slice";
import {
  cancelActiveExportRequested,
  cancelAllExportsRequested,
  startExportQueue,
} from "@/app/store/thunks/export-thunks";
import type { QueueFinishAction } from "@/lib/tauri/queue.types";

export function MenuBarQueue() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const queue = useAppSelector(selectExportQueue);
  const deleteSourceOnRenderFinish = useAppSelector(selectDeleteSourceOnRenderFinish);
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
      <MenubarMenu value="queue">
        <MenubarTrigger asChild>
          <Button className="text-foreground/80" size="xs" type="button" variant="ghost">
            {t("queue.labels.title")}
          </Button>
        </MenubarTrigger>
        <MenubarContent>
          <MenubarGroup>
            <MenubarItem
              aria-keyshortcuts="Enter"
              disabled={!hasQueuedItems || queueStarted}
              inset
              onSelect={() => void dispatch(startExportQueue({ id: "queue.start", type: "menu" }))}
            >
              {t("queue.actions.start")}
              <MenubarShortcut>
                <Kbd>Enter</Kbd>
              </MenubarShortcut>
            </MenubarItem>
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <MenubarItem
              disabled={!hasActiveItem}
              inset
              onSelect={() => void dispatch(cancelActiveExportRequested())}
            >
              {t("queue.actions.skip")}
            </MenubarItem>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <MenubarItem disabled={!hasQueuedItems && !hasActiveItem} inset keepOpen>
                  {t("queue.actions.cancel")}
                </MenubarItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("queue.dialogs.cancel.title")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("queue.dialogs.cancel.description")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.actions.back")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => void dispatch(cancelAllExportsRequested())}
                    variant="destructive"
                  >
                    {t("queue.actions.cancel")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <AlertDialog>
              <Tooltip preserveOnTrigger>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <MenubarCheckboxItem
                      checked={deleteSourceOnRenderFinish}
                      keepOpen
                      onSelect={() => {
                        if (deleteSourceOnRenderFinish) {
                          dispatch(
                            preferenceChanged({
                              enabled: false,
                              key: "deleteSourceOnRenderFinish",
                            }),
                          );
                        }
                      }}
                      variant="destructive"
                    >
                      {t("queue.labels.deleteSource")}
                    </MenubarCheckboxItem>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {t("queue.tooltips.deleteSourceOnRenderFinish")}
                </TooltipContent>
              </Tooltip>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("queue.dialogs.deleteSourceOnRenderFinish.title")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("queue.dialogs.deleteSourceOnRenderFinish.description")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.actions.back")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      dispatch(
                        preferenceChanged({ enabled: true, key: "deleteSourceOnRenderFinish" }),
                      )
                    }
                    variant="destructive"
                  >
                    {t("common.actions.enable")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <MenubarSub>
              <MenubarSubTrigger inset variant="destructive">
                <MenubarIcon>{queueFinishIcons[queueFinishAction]}</MenubarIcon>
                {t("queue.labels.onFinish")}
              </MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarRadioGroup
                  onValueChange={(action) =>
                    dispatch(queueFinishActionChanged(action as QueueFinishAction))
                  }
                  value={queueFinishAction}
                >
                  {availableQueueFinishActions.map((action) => (
                    <MenubarRadioItem inset key={action} value={action}>
                      {queueFinishLabels[action]}
                      <MenubarIcon side="right">{queueFinishIcons[action]}</MenubarIcon>
                    </MenubarRadioItem>
                  ))}
                </MenubarRadioGroup>
              </MenubarSubContent>
            </MenubarSub>
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>
    </>
  );
}
