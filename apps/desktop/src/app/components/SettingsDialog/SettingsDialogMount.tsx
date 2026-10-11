import { Suspense } from "react";

import { useSettingsDialog } from "../../hooks/useSettingsDialog";

import { LazySettingsDialog } from "./settings-dialog.loader";

function SettingsDialogMount() {
  const { isSettingsOpen } = useSettingsDialog();

  if (!isSettingsOpen) return null;

  return (
    <Suspense fallback={null}>
      <LazySettingsDialog />
    </Suspense>
  );
}

export { SettingsDialogMount };
