import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

import { SettingsDialogContext } from "@/app/contexts/settings-dialog-context";
import { preloadAppSettingsDialog } from "@/app/dialogs/AppSettingsDialog/app-settings-dialog.loader";

function SettingsDialogProvider({ children }: { children: ReactNode }) {
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const openSettings = useCallback(() => {
    void preloadAppSettingsDialog().catch(() => undefined);
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const value = useMemo(
    () => ({ closeSettings, isSettingsOpen, openSettings }),
    [closeSettings, isSettingsOpen, openSettings],
  );

  return <SettingsDialogContext.Provider value={value}>{children}</SettingsDialogContext.Provider>;
}

export { SettingsDialogProvider };
