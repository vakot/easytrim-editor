import { Suspense } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";

import { useSettingsDialog } from "@/app/hooks/useSettingsDialog";
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
      <Dialog onOpenChange={(open) => !open && closeSettings()} open={isSettingsOpen}>
        <DialogContent className="h-full max-h-[min(80dvh,32rem)] grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <Suspense fallback={null}>
            <LazyAppSettingsDialogContent />
          </Suspense>
        </DialogContent>
      </Dialog>
    );
  },
  { preload: () => LazyAppSettingsDialogContent.preload() },
);

export { AppSettingsDialog };
