import { Suspense } from "react";

import { lazyWithPreload } from "@easytrim-editor/ui/lazy-component";

import { createDialogScope, Dialog, DialogContent } from "@/components/ui/dialog";

import { useSettingsDialog } from "@/app/hooks/useAppDialog";

const useAppSettingsDialogScope = createDialogScope();

const LazyAppSettingsDialogContent = lazyWithPreload<{
  __scopeDialog?: React.ComponentProps<typeof Dialog>["__scopeDialog"];
}>(() =>
  import("./AppSettingsDialogContent").then((module) => ({
    default: module.AppSettingsDialogContent,
  })),
);

const AppSettingsDialog = Object.assign(
  function AppSettingsDialog({
    __scopeDialog,
  }: {
    __scopeDialog?: React.ComponentProps<typeof Dialog>["__scopeDialog"];
  }) {
    const dialogScope = useAppSettingsDialogScope(__scopeDialog);
    const { closeDialog, isOpen } = useSettingsDialog();

    return (
      <Dialog {...dialogScope} onOpenChange={(open) => !open && closeDialog()} open={isOpen}>
        <DialogContent
          {...dialogScope}
          className="h-full max-h-[min(80dvh,32rem)] grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-0 overflow-hidden p-0 sm:max-w-3xl"
        >
          <Suspense fallback={null}>
            <LazyAppSettingsDialogContent __scopeDialog={dialogScope.__scopeDialog} />
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
