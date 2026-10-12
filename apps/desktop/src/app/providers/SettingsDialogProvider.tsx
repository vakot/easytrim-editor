import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

import { SettingsDialogContext } from "@/app/contexts/settings-dialog-context";
import { AppSettingsDialog } from "@/app/dialogs/AppSettingsDialog";

function SettingsDialogProvider({ children }: { children: ReactNode }) {
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const openSettings = useCallback(() => {
    void AppSettingsDialog.preload().catch(() => undefined);
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
