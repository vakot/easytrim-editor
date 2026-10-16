import { Suspense } from "react";

import type { DialogScope } from "@/components/ui/dialog";
import { createDialogScope, Dialog, DialogContent } from "@/components/ui/dialog";

import { useAchievementsDialog } from "@/app/hooks/useAppDialog";
import { lazyWithPreload } from "@/lib/lazy-component";

const useAppAchievementsDialogScope = createDialogScope();

const LazyAppAchievementsDialogContent = lazyWithPreload<{
  __scopeDialog?: DialogScope;
}>(() =>
  import("./AppAchievementsDialogContent").then((module) => ({
    default: module.AppAchievementsDialogContent,
  })),
);

/** Shows the achievement collection and the progress toward each achievement. */
const AppAchievementsDialog = Object.assign(
  function AppAchievementsDialog({ __scopeDialog }: { __scopeDialog?: DialogScope }) {
    const dialogScope = useAppAchievementsDialogScope(__scopeDialog);
    const { closeDialog, isOpen } = useAchievementsDialog();

    return (
      <Dialog {...dialogScope} onOpenChange={(open) => !open && closeDialog()} open={isOpen}>
        <DialogContent
          {...dialogScope}
          className="grid h-[min(80dvh,44rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden sm:max-w-2xl"
        >
          <Suspense fallback={null}>
            <LazyAppAchievementsDialogContent __scopeDialog={dialogScope.__scopeDialog} />
          </Suspense>
        </DialogContent>
      </Dialog>
    );
  },
  { preload: () => LazyAppAchievementsDialogContent.preload() },
);

export { AppAchievementsDialog };
