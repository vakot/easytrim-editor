import { type ReactNode, useCallback, useMemo, useState } from "react";

import { COMMAND_PALETTE_SHORTCUT } from "@/app/commands/core/application-command.shortcuts";
import { isShortcutEvent } from "@/app/commands/core/application-command.utils";
import type { AppDialogId, AppDialogOpenOptions } from "@/app/contexts/app-dialogs-context";
import { AppDialogsContext } from "@/app/contexts/app-dialogs-context";
import { AppChangelogDialog } from "@/app/dialogs/AppChangelogDialog";
import { AppChaptersDialog } from "@/app/dialogs/AppChaptersDialog";
import { AppCommandPaletteDialog } from "@/app/dialogs/AppCommandPaletteDialog";
import { AppSettingsDialog } from "@/app/dialogs/AppSettingsDialog";
import { AppStatisticsDialog } from "@/app/dialogs/AppStatisticsDialog";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";
import { isApplicationInteractionBlocked, isEditableTarget } from "@/lib/hotkeys.utils";

const dialogPreloaders: Record<AppDialogId, () => Promise<unknown>> = {
  changelog: AppChangelogDialog.preload,
  chapters: AppChaptersDialog.preload,
  "command-palette": AppCommandPaletteDialog.preload,
  settings: AppSettingsDialog.preload,
  statistics: AppStatisticsDialog.preload,
};

function AppDialogsProvider({ children }: { children: ReactNode }) {
  const [openDialogIds, setOpenDialogIds] = useState<ReadonlySet<AppDialogId>>(() => new Set());
  const [manualDialogIds, setManualDialogIds] = useState<ReadonlySet<AppDialogId>>(() => new Set());

  const isOpen = useCallback(
    (dialogId: AppDialogId) => openDialogIds.has(dialogId),
    [openDialogIds],
  );

  const isManualOpen = useCallback(
    (dialogId: AppDialogId) => manualDialogIds.has(dialogId),
    [manualDialogIds],
  );

  const openDialog = useCallback((dialogId: AppDialogId, options?: AppDialogOpenOptions) => {
    void dialogPreloaders[dialogId]().catch(() => undefined);
    setOpenDialogIds((current) =>
      current.has(dialogId) ? current : new Set(current).add(dialogId),
    );
    if (options?.manual) {
      setManualDialogIds((current) =>
        current.has(dialogId) ? current : new Set(current).add(dialogId),
      );
    }
  }, []);

  const closeDialog = useCallback((dialogId: AppDialogId) => {
    setOpenDialogIds((current) => {
      if (!current.has(dialogId)) return current;
      const next = new Set(current);
      next.delete(dialogId);
      return next;
    });
    setManualDialogIds((current) => {
      if (!current.has(dialogId)) return current;
      const next = new Set(current);
      next.delete(dialogId);
      return next;
    });
  }, []);

  const toggleDialog = useCallback((dialogId: AppDialogId) => {
    void dialogPreloaders[dialogId]().catch(() => undefined);
    setOpenDialogIds((current) => {
      const next = new Set(current);
      if (current.has(dialogId)) next.delete(dialogId);
      else next.add(dialogId);
      return next;
    });
    setManualDialogIds((current) => {
      if (!current.has(dialogId)) return current;
      const next = new Set(current);
      next.delete(dialogId);
      return next;
    });
  }, []);

  useKeyboardShortcut(
    (event) =>
      isShortcutEvent(event, COMMAND_PALETTE_SHORTCUT) &&
      (isOpen("command-palette") ||
        (!isEditableTarget(event.target) && !isApplicationInteractionBlocked())),
    () => toggleDialog("command-palette"),
    { allowEditableTarget: true },
  );

  const value = useMemo(
    () => ({ closeDialog, isManualOpen, isOpen, openDialog, toggleDialog }),
    [closeDialog, isManualOpen, isOpen, openDialog, toggleDialog],
  );

  return <AppDialogsContext.Provider value={value}>{children}</AppDialogsContext.Provider>;
}

export { AppDialogsProvider };
