import { Suspense } from "react";

import { useSettingsDialog } from "@/app/hooks/useSettingsDialog";
import { LibraryDialog, LibraryDialogContent } from "@/components/library";

import { LazyAppSettingsDialogContent } from "./app-settings-dialog.loader";

function AppSettingsDialog() {
  const { closeSettings, isSettingsOpen } = useSettingsDialog();

  return (
    <LibraryDialog onOpenChange={(open) => !open && closeSettings()} open={isSettingsOpen}>
      <LibraryDialogContent>
        <Suspense fallback={null}>
          <LazyAppSettingsDialogContent />
        </Suspense>
      </LibraryDialogContent>
    </LibraryDialog>
  );
}

export { AppSettingsDialog };
