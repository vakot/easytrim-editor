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

function SettingsPreferences() {
  const { t } = useTranslation();
  const { executeCommand } = useApplicationCommands();
  const queueFinishAction = useAppSelector(selectQueueFinishAction);
  const availableQueueFinishActions = useAppSelector(selectAvailableQueueFinishActions);

  return (
    <>
      <SettingsSection title={t("settings.preferences.editing.title")}>
        <SettingRow
          description={t("settings.preferences.loopPlayback.description")}
          label={t("settings.preferences.loopPlayback.label")}
        >
          <CommandSwitch
            aria-label={t("settings.preferences.loopPlayback.label")}
            commandId="preference-loop-playback"
          />
        </SettingRow>

        <SettingRow
          description={t("settings.preferences.followSegment.description")}
          label={t("settings.preferences.followSegment.label")}
        >
          <CommandSwitch
            aria-label={t("settings.preferences.followSegment.label")}
            commandId="preference-segment-playback"
          />
        </SettingRow>

        <SettingRow
          description={t("settings.preferences.mergeAudio.description")}
          label={t("settings.preferences.mergeAudio.label")}
        >
          <CommandSwitch
            aria-label={t("settings.preferences.mergeAudio.label")}
            commandId="preference-merge-audio"
          />
        </SettingRow>

        <SettingRow
          description={t("settings.preferences.stripMetadata.description")}
          label={t("settings.preferences.stripMetadata.label")}
        >
          <CommandSwitch
            aria-label={t("settings.preferences.stripMetadata.label")}
            commandId="preference-strip-metadata"
          />
        </SettingRow>

        <SettingRow label={t("settings.preferences.reset")}>
          <CommandReset
            aria-label={t("settings.preferences.reset")}
            commandId="reset-editing-settings"
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title={t("settings.queue.title")}>
        <SettingRow
          description={t("settings.queue.autoStart.description")}
          label={t("settings.queue.autoStart.label")}
        >
          <CommandSwitch
            aria-label={t("settings.queue.autoStart.label")}
            commandId="preference-auto-start-queue"
          />
        </SettingRow>

        <SettingRow
          description={t("queue.deleteSource.tooltip")}
          label={t("queue.deleteSource.label")}
        >
          <CommandSwitch
            aria-label={t("queue.deleteSource.label")}
            commandId="delete-source-on-render-finish"
          />
        </SettingRow>

        <SettingRow
          description={t("settings.queue.onFinished.description")}
          label={t("queue.onFinished.label")}
        >
          <Select
            onValueChange={(value) =>
              void executeCommand(getQueueFinishCommandId(value as QueueFinishAction), "dialog")
            }
            value={queueFinishAction}
          >
            <SelectTrigger aria-label={t("queue.onFinished.label")} className="w-44">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              {availableQueueFinishActions.map((action) => (
                <QueueFinishSelectItem action={action} key={action} />
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow label={t("settings.queue.reset")}>
          <CommandReset aria-label={t("settings.queue.reset")} commandId="reset-queue-settings" />
        </SettingRow>
      </SettingsSection>
    </>
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

export { SettingsPreferences };
