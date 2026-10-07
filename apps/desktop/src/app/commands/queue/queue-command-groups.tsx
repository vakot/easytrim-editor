import { useTranslation } from "react-i18next";

import { defineApplicationCommandGroup } from "@/app/commands/core/application-command.utils";

import { useAutoStartQueueCommand } from "./definitions/auto-start-queue.command";
import { useDeleteSourceOnFinishCommand } from "./definitions/delete-source-on-finish.command";
import { useOpenExportQueueCommand } from "./definitions/open-export-queue.command";
import { useQueueFinishCommands } from "./definitions/queue-finish.commands";
import { useResetQueueSettingsCommand } from "./definitions/reset-queue-settings.command";

function useQueueCommandGroups() {
  const { t } = useTranslation();
  const deleteSource = useDeleteSourceOnFinishCommand();
  const autoStartQueue = useAutoStartQueueCommand();
  const openExportQueue = useOpenExportQueueCommand();
  const finishActions = useQueueFinishCommands();
  const resetQueueSettings = useResetQueueSettingsCommand();
  return [
    defineApplicationCommandGroup(
      "queue-on-finished-source",
      t("commands.sections.queueOnFinishedSource"),
      [deleteSource],
    ),
    defineApplicationCommandGroup(
      "queue-on-finished-application",
      t("commands.sections.queueOnFinishedApplication"),
      finishActions,
    ),
    defineApplicationCommandGroup("queue", t("queue.title"), [
      openExportQueue,
      autoStartQueue,
      resetQueueSettings,
    ]),
  ] as const;
}

export { useQueueCommandGroups };
