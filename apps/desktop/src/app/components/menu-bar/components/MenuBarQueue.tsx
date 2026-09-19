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
import {
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarIcon,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
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
  selectQueueFinishAction,
} from "@/app/store/slices/export-slice";
import {
  preferenceChanged,
  selectDeleteSourceOnRenderFinish,
} from "@/app/store/slices/preferences-slice";
import type { QueueFinishAction } from "@/lib/tauri/queue.types";

export function MenuBarQueue() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const deleteSourceOnRenderFinish = useAppSelector(selectDeleteSourceOnRenderFinish);
  const queueFinishAction = useAppSelector(selectQueueFinishAction);
  const availableQueueFinishActions = useAppSelector(selectAvailableQueueFinishActions);

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

  const deleteSourceMenuItem = (
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
  );

  return (
    <>
      <MenubarMenu value="queue">
        <MenubarTrigger asChild>
          <Button className="text-foreground/80" size="sm" type="button" variant="ghost">
            {t("queue.labels.title")}
          </Button>
        </MenubarTrigger>
        <MenubarContent>
          <MenubarGroup>
            <AlertDialog>
              <Tooltip preserveOnTrigger>
                <TooltipTrigger asChild>
                  {deleteSourceOnRenderFinish ? (
                    deleteSourceMenuItem
                  ) : (
                    <AlertDialogTrigger asChild>{deleteSourceMenuItem}</AlertDialogTrigger>
                  )}
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
