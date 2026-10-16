import { createContext } from "react";

type AppDialogId = "changelog" | "chapters" | "command-palette" | "settings";

interface AppDialogOpenOptions {
  manual?: boolean;
}

interface AppDialogsContextValue {
  closeDialog: (dialogId: AppDialogId) => void;
  isManualOpen: (dialogId: AppDialogId) => boolean;
  isOpen: (dialogId: AppDialogId) => boolean;
  openDialog: (dialogId: AppDialogId, options?: AppDialogOpenOptions) => void;
  toggleDialog: (dialogId: AppDialogId) => void;
}

const AppDialogsContext = createContext<AppDialogsContextValue | null>(null);

export { AppDialogsContext };
export type { AppDialogId, AppDialogOpenOptions, AppDialogsContextValue };
