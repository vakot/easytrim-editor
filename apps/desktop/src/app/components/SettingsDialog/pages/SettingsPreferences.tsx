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
      <SettingsSection title={t("settings.pages.preferences.sectionTitle")}>
        <SettingRow
          description={t("settings.pages.preferences.loopDescription")}
          label={t("settings.labels.loop")}
        >
          <CommandSwitch
            aria-label={t("settings.labels.loop")}
            commandId="preference-loop-playback"
          />
        </SettingRow>

        <SettingRow
          description={t("settings.pages.preferences.followSegmentDescription")}
          label={t("settings.labels.followSegment")}
        >
          <CommandSwitch
            aria-label={t("settings.labels.followSegment")}
            commandId="preference-segment-playback"
          />
        </SettingRow>

        <SettingRow
          description={t("settings.pages.preferences.mergeAudioDescription")}
          label={t("settings.labels.mergeAudio")}
        >
          <CommandSwitch
            aria-label={t("settings.labels.mergeAudio")}
            commandId="preference-merge-audio"
          />
        </SettingRow>

        <SettingRow label={t("settings.pages.preferences.resetLabel")}>
          <CommandReset
            aria-label={t("settings.pages.preferences.resetLabel")}
            commandId="reset-preferences-settings"
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title={t("settings.pages.queue.title")}>
        <SettingRow
          description={t("settings.pages.queue.autoStartDescription")}
          label={t("settings.labels.autoStartQueue")}
        >
          <CommandSwitch
            aria-label={t("settings.labels.autoStartQueue")}
            commandId="preference-auto-start-queue"
          />
        </SettingRow>

        <SettingRow
          description={t("queue.tooltips.deleteSourceOnRenderFinish")}
          label={t("queue.labels.deleteSource")}
        >
          <CommandSwitch
            aria-label={t("queue.labels.deleteSource")}
            commandId="delete-source-on-render-finish"
          />
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
          <CommandReset
            aria-label={t("settings.pages.queue.resetLabel")}
            commandId="reset-queue-settings"
          />
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
