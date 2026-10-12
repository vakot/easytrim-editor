import { Suspense } from "react";

import { useSettingsDialog } from "@/app/hooks/useSettingsDialog";
import { LibraryDialog, LibraryDialogContent } from "@/components/library";
import { lazyWithPreload } from "@/lib/lazy-component";

const LazyAppSettingsDialogContent = lazyWithPreload<Record<string, never>>(() =>
  import("./AppSettingsDialogContent").then((module) => ({
    default: module.AppSettingsDialogContent,
  })),
);

const AppSettingsDialog = Object.assign(
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
  },
  { preload: () => LazyAppSettingsDialogContent.preload() },
);

export { AppSettingsDialog };
