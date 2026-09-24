import { CircleStop, LogOut, Moon, Power } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

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

import {
  ApplicationCommandLabel,
  ApplicationCommandMenuItem,
} from "@/app/components/ApplicationCommandMenuItem";
import { useAppSelector } from "@/app/store/redux-hooks";
import {
  selectAvailableQueueFinishActions,
  selectQueueFinishAction,
} from "@/app/store/slices/export-slice";
import type { QueueFinishAction } from "@/lib/tauri/queue.types";

function MenuBarQueue() {
  const { t } = useTranslation();
  const queueFinishAction = useAppSelector(selectQueueFinishAction);
  const availableQueueFinishActions = useAppSelector(selectAvailableQueueFinishActions);

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
          <Button className="text-foreground/80" size="sm" type="button" variant="ghost">
            {t("queue.labels.title")}
          </Button>
        </MenubarTrigger>
        <MenubarContent>
          <MenubarGroup>
            <Tooltip preserveOnTrigger>
              <TooltipTrigger asChild>
                <ApplicationCommandMenuItem asChild commandId="delete-source-on-render-finish">
                  <MenubarCheckboxItem keepOpen variant="destructive">
                    <ApplicationCommandLabel />
                  </MenubarCheckboxItem>
                </ApplicationCommandMenuItem>
              </TooltipTrigger>
              <TooltipContent side="right">
                {t("queue.tooltips.deleteSourceOnRenderFinish")}
              </TooltipContent>
            </Tooltip>
            <MenubarSub>
              <MenubarSubTrigger inset variant="destructive">
                <MenubarIcon>{queueFinishIcons[queueFinishAction]}</MenubarIcon>
                {t("queue.labels.onFinish")}
              </MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarRadioGroup value={queueFinishAction}>
                  {availableQueueFinishActions.map((action) => (
                    <ApplicationCommandMenuItem
                      asChild
                      commandId={`queue-finish-${action === "systemSleep" ? "system-sleep" : action === "systemShutdown" ? "system-shutdown" : action}`}
                      key={action}
                    >
                      <MenubarRadioItem inset value={action}>
                        <ApplicationCommandLabel />
                        <MenubarIcon side="right">{queueFinishIcons[action]}</MenubarIcon>
                      </MenubarRadioItem>
                    </ApplicationCommandMenuItem>
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

export { MenuBarQueue };
