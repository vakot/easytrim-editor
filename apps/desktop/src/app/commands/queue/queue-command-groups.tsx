import { useTranslation } from "react-i18next";

import { defineApplicationCommandGroup } from "@/app/commands/core/application-command.utils";

import { useDeleteSourceOnFinishCommand } from "./definitions/delete-source-on-finish.command";
import { useOpenExportQueueCommand } from "./definitions/open-export-queue.command";
import { useQueueFinishCommands } from "./definitions/queue-finish.commands";
import { useResetQueueSettingsCommand } from "./definitions/reset-queue-settings.command";

function useQueueCommandGroups() {
  const { t } = useTranslation();
  const deleteSource = useDeleteSourceOnFinishCommand();
  const openExportQueue = useOpenExportQueueCommand();
  const finishActions = useQueueFinishCommands();
  const resetQueueSettings = useResetQueueSettingsCommand();
  return [
    defineApplicationCommandGroup(
      "queue-on-finished-source",
      t("app.labels.commandSections.queueOnFinishedSource"),
      [deleteSource],
    ),
    defineApplicationCommandGroup(
      "queue-on-finished-application",
      t("app.labels.commandSections.queueOnFinishedApplication"),
      finishActions,
    ),
    defineApplicationCommandGroup("queue", t("queue.labels.title"), [
      openExportQueue,
      resetQueueSettings,
    ]),
  ] as const;
}

export { useQueueCommandGroups };
