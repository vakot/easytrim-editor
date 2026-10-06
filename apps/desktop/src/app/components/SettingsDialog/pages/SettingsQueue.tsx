import { useTranslation } from "react-i18next";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { getQueueFinishCommandId } from "@/app/commands/queue";
import { useApplicationCommand, useApplicationCommands } from "@/app/hooks/useApplicationCommands";
import { useAppSelector } from "@/app/store/redux-hooks";
import {
  selectAvailableQueueFinishActions,
  selectQueueFinishAction,
} from "@/app/store/slices/export-slice";
import type { QueueFinishAction } from "@/lib/tauri/queue.types";

import { CommandReset, CommandSwitch, SettingRow, SettingsSection } from "../components/SettingRow";

function SettingsQueue() {
  const { t } = useTranslation();
  const { executeCommand } = useApplicationCommands();
  const queueFinishAction = useAppSelector(selectQueueFinishAction);
  const availableQueueFinishActions = useAppSelector(selectAvailableQueueFinishActions);

  return (
    <SettingsSection title={t("settings.pages.queue.title")}>
      <SettingRow
        description={t("settings.pages.queue.autoStartDescription")}
        label={t("settings.labels.autoStartQueue")}
      >
        <CommandSwitch
          commandId="preference-auto-start-queue"
          label={t("settings.labels.autoStartQueue")}
        />
      </SettingRow>

      <SettingRow
        description={t("queue.tooltips.deleteSourceOnRenderFinish")}
        label={t("queue.labels.deleteSource")}
      >
        <CommandSwitch commandId="delete-source-on-render-finish" label={t("queue.labels.deleteSource")} />
      </SettingRow>

      <SettingRow
        description={t("settings.pages.queue.onFinishedDescription")}
        label={t("queue.labels.onFinish")}
      >
        <Select
          onValueChange={(value) =>
            void executeCommand(getQueueFinishCommandId(value as QueueFinishAction), "dialog")
          }
          value={queueFinishAction}
        >
          <SelectTrigger aria-label={t("queue.labels.onFinish")} className="w-44">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            {availableQueueFinishActions.map((action) => (
              <QueueFinishSelectItem action={action} key={action} />
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow label={t("settings.pages.queue.resetLabel")}>
        <CommandReset commandId="reset-queue-settings" />
      </SettingRow>
    </SettingsSection>
  );
}

function QueueFinishSelectItem({ action }: { action: QueueFinishAction }) {
  const command = useApplicationCommand(getQueueFinishCommandId(action));

  return (
    <SelectItem disabled={!command.enabled} value={action}>
      {command.label}
    </SelectItem>
  );
}

export { SettingsQueue };
