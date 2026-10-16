import { Suspense } from "react";

import type { DialogScope } from "@/components/ui/dialog";
import { createDialogScope, Dialog, DialogContent } from "@/components/ui/dialog";

import { useStatisticsDialog } from "@/app/hooks/useAppDialog";
import { lazyWithPreload } from "@/lib/lazy-component";

const useAppStatisticsDialogScope = createDialogScope();

const LazyAppStatisticsDialogContent = lazyWithPreload<{
  __scopeDialog?: DialogScope;
}>(() =>
  import("./AppStatisticsDialogContent").then((module) => ({
    default: module.AppStatisticsDialogContent,
  })),
);

/** Shows the persistent usage statistics collected from successful exports. */
const AppStatisticsDialog = Object.assign(
  function AppStatisticsDialog({ __scopeDialog }: { __scopeDialog?: DialogScope }) {
    const dialogScope = useAppStatisticsDialogScope(__scopeDialog);
    const { closeDialog, isOpen } = useStatisticsDialog();

    return (
      <Dialog {...dialogScope} onOpenChange={(open) => !open && closeDialog()} open={isOpen}>
        <DialogContent
          {...dialogScope}
          className="grid max-h-[min(80dvh,44rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden sm:max-w-2xl"
        >
          <Suspense fallback={null}>
            <LazyAppStatisticsDialogContent __scopeDialog={dialogScope.__scopeDialog} />
          </Suspense>
        </DialogContent>
      </Dialog>
    );
  },
  { preload: () => LazyAppStatisticsDialogContent.preload() },
);

export { AppStatisticsDialog };
