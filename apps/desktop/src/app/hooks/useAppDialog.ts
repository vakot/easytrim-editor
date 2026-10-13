import { useCallback, useContext } from "react";

import type { AppDialogId } from "@/app/contexts/app-dialogs-context";
import { AppDialogsContext } from "@/app/contexts/app-dialogs-context";

function useAppDialog(dialogId: AppDialogId) {
  const context = useContext(AppDialogsContext);
  if (!context) throw new Error("useAppDialog must be used within AppDialogsProvider.");

  const {
    closeDialog: closeAppDialog,
    isOpen: isDialogOpen,
    openDialog: openAppDialog,
    toggleDialog: toggleAppDialog,
  } = context;

  const openDialog = useCallback(() => openAppDialog(dialogId), [dialogId, openAppDialog]);
  const closeDialog = useCallback(() => closeAppDialog(dialogId), [closeAppDialog, dialogId]);
  const toggleDialog = useCallback(() => toggleAppDialog(dialogId), [dialogId, toggleAppDialog]);

  return { closeDialog, isOpen: isDialogOpen(dialogId), openDialog, toggleDialog };
}

function useCommandPaletteDialog() {
  return useAppDialog("command-palette");
}

function useChangelogDialog() {
  const dialog = useAppDialog("changelog");
  const context = useContext(AppDialogsContext);
  if (!context) throw new Error("useAppDialog must be used within AppDialogsProvider.");

  const openDialog = useCallback(
    () => context.openDialog("changelog", { manual: true }),
    [context],
  );

  return {
    ...dialog,
    isManualOpen: context.isManualOpen("changelog"),
    openDialog,
    openDialogAutomatically: dialog.openDialog,
  };
}

function useSettingsDialog() {
  return useAppDialog("settings");
}

export { useAppDialog, useChangelogDialog, useCommandPaletteDialog, useSettingsDialog };
