import { Suspense } from "react";

import { lazyWithPreload } from "@easytrim-editor/ui/lazy-component";

import type { DialogScope } from "@/components/ui/dialog";
import { createDialogScope, Dialog, DialogContent } from "@/components/ui/dialog";

import { useChaptersDialog } from "@/app/hooks/useAppDialog";

const useAppChaptersDialogScope = createDialogScope();

const LazyAppChaptersDialogContent = lazyWithPreload<{
  __scopeDialog?: DialogScope;
}>(() =>
  import("./AppChaptersDialogContent").then((module) => ({
    default: module.AppChaptersDialogContent,
  })),
);

/** Lists the source's chapters, to add, rename, re-range or delete them. */
const AppChaptersDialog = Object.assign(
  function AppChaptersDialog({ __scopeDialog }: { __scopeDialog?: DialogScope }) {
    const dialogScope = useAppChaptersDialogScope(__scopeDialog);
    const { closeDialog, isOpen } = useChaptersDialog();

    return (
      <Dialog {...dialogScope} onOpenChange={(open) => !open && closeDialog()} open={isOpen}>
        <DialogContent
          {...dialogScope}
          className="h-[min(80dvh,40rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden sm:max-w-lg"
        >
          <Suspense fallback={null}>
            <LazyAppChaptersDialogContent __scopeDialog={dialogScope.__scopeDialog} />
          </Suspense>
        </DialogContent>
      </Dialog>
    );
  },
  { preload: () => LazyAppChaptersDialogContent.preload() },
);

export { AppChaptersDialog };
