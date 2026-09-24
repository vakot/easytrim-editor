import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
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
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { getQueueFinishCommandId } from "@/app/commands/queue";
import {
  ApplicationCommandIcon,
  ApplicationCommandLabel,
  ApplicationCommandMenuItem,
} from "@/app/components/ApplicationCommandMenuItem";
import { useApplicationCommand } from "@/app/hooks/useApplicationCommands";
import { useAppSelector } from "@/app/store/redux-hooks";
import {
  selectAvailableQueueFinishActions,
  selectQueueFinishAction,
} from "@/app/store/slices/export-slice";

function MenuBarQueue() {
  const { t } = useTranslation();

  return (
    <>
      <MenubarMenu value="queue">
        <MenubarTrigger asChild>
          <Button className="text-foreground/80" size="sm" type="button" variant="ghost">
            {t("queue.labels.title")}
          </Button>
        </MenubarTrigger>
        <MenubarContent>
          <MenuBarQueueContent />
        </MenubarContent>
      </MenubarMenu>
    </>
  );
}

function MenuBarQueueContent() {
  const { t } = useTranslation();

  const queueFinishAction = useAppSelector(selectQueueFinishAction);
  const availableQueueFinishActions = useAppSelector(selectAvailableQueueFinishActions);
  const selectedActionCommand = useApplicationCommand(getQueueFinishCommandId(queueFinishAction));

  return (
    <>
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
            <MenubarIcon>
              <ApplicationCommandIcon className="size-3" command={selectedActionCommand} />
            </MenubarIcon>
            {t("queue.labels.onFinish")}
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarRadioGroup value={queueFinishAction}>
              {availableQueueFinishActions.map((action) => (
                <ApplicationCommandMenuItem
                  asChild
                  commandId={getQueueFinishCommandId(action)}
                  key={action}
                >
                  <MenubarRadioItem inset value={action}>
                    <ApplicationCommandLabel />
                    <MenubarIcon side="right">
                      <ApplicationCommandIcon className="size-3" />
                    </MenubarIcon>
                  </MenubarRadioItem>
                </ApplicationCommandMenuItem>
              ))}
            </MenubarRadioGroup>
          </MenubarSubContent>
        </MenubarSub>
      </MenubarGroup>
      <MenubarSeparator />
      <MenubarGroup>
        <ApplicationCommandMenuItem asChild commandId="reset-queue-settings">
          <MenubarItem inset keepOpen variant="destructive">
            <MenubarIcon>
              <ApplicationCommandIcon />
            </MenubarIcon>
            <ApplicationCommandLabel />
          </MenubarItem>
        </ApplicationCommandMenuItem>
      </MenubarGroup>
    </>
  );
}

export { MenuBarQueue, MenuBarQueueContent };
