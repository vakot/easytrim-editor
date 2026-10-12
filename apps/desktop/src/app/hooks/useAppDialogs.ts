import { useContext } from "react";

import { AppDialogsContext } from "@/app/contexts/app-dialogs-context";

function useAppDialogs() {
  const context = useContext(AppDialogsContext);
  if (!context) throw new Error("useAppDialogs must be used within AppDialogsProvider.");
  return context;
}

export { useAppDialogs };
