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
    const { closeDialog, isOpen } = useSettingsDialog();

    return (
      <Dialog onOpenChange={(open) => !open && closeDialog()} open={isOpen}>
        <DialogContent className="h-full max-h-[min(80dvh,32rem)] grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <Suspense fallback={null}>
            <LazyAppSettingsDialogContent />
          </Suspense>
        </DialogContent>
      </Dialog>
    );
  },
  {
    preload: () =>
      Promise.all([LazyAppSettingsDialogContent.preload(), import("./pages/SettingsGeneral")]).then(
        () =>
          import("./AppSettingsDialogContent").then((module) =>
            module.AppSettingsDialogContent.preloadDefaultPage(),
          ),
      ),
  },
);

export { AppSettingsDialog };
