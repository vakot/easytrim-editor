import { createContext } from "react";

type AppDialogId = "command-palette" | "settings";

interface AppDialogsContextValue {
  closeDialog: (dialogId: AppDialogId) => void;
  isOpen: (dialogId: AppDialogId) => boolean;
  openDialog: (dialogId: AppDialogId) => void;
  toggleDialog: (dialogId: AppDialogId) => void;
}

const AppDialogsContext = createContext<AppDialogsContextValue | null>(null);

export { AppDialogsContext };
export type { AppDialogId, AppDialogsContextValue };
