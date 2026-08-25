import { useTranslation } from "react-i18next";

import packageJson from "../../../../../../package.json";

import { HelpMenu } from "./menus/help";
import { FileMenu } from "./menus/file";
import { QueueMenu } from "./menus/queue";
import { SettingsMenu } from "./menus/settings";
import { ViewMenu } from "./menus/view";
import { useContextMenuNavigation } from "./hooks/useContextMenuNavigation";
import type { ContextMenusProps } from "./types";

export function ContextMenus({
  isChoosingSource,
  hasSource = false,
  canSave,
  canExport,
  onChooseSource,
  onCloseFile = () => undefined,
  onSave,
  onExport,
  queueStarted = false,
  hasQueuedItems = false,
  hasActiveItem = false,
  onQueueStartedChange = () => undefined,
  onCancelActive = () => undefined,
  onCancelQueue = () => undefined,
  queueFinishAction = "nothing",
  availableQueueFinishActions = ["exit", "nothing"],
  onQueueFinishActionChange = () => undefined,
  toolDefaults,
  onToolDefaultChange,
  onResetToolDefaults,
}: ContextMenusProps) {
  const { t } = useTranslation();
  const navigation = useContextMenuNavigation();

  return (
    <nav className="flex h-full items-center gap-0.5" aria-label={t("app.topBarMenus.label")}>
      <FileMenu
        navigation={navigation.file}
        isChoosingSource={isChoosingSource}
        hasSource={hasSource}
        canSave={canSave}
        canExport={canExport}
        onChooseSource={onChooseSource}
        onCloseFile={onCloseFile}
        onSave={onSave}
        onExport={onExport}
      />
      <ViewMenu navigation={navigation.view} />
      <QueueMenu
        navigation={navigation.queue}
        queueStarted={queueStarted}
        hasQueuedItems={hasQueuedItems}
        hasActiveItem={hasActiveItem}
        onQueueStartedChange={onQueueStartedChange}
        onCancelActive={onCancelActive}
        onCancelQueue={onCancelQueue}
        queueFinishAction={queueFinishAction}
        availableQueueFinishActions={availableQueueFinishActions}
        onQueueFinishActionChange={onQueueFinishActionChange}
      />
      <SettingsMenu
        navigation={navigation.settings}
        toolDefaults={toolDefaults}
        onToolDefaultChange={onToolDefaultChange}
        onResetToolDefaults={onResetToolDefaults}
      />
      <HelpMenu navigation={navigation.help} version={packageJson.version} />
    </nav>
  );
}
