import { Suspense } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";

import { lazyWithPreload } from "@/lib/lazy-component";

import type { ChangelogDialogContentProps } from "./ChangelogDialogContent";

type ChangelogDialogMode = "changelog" | "whats-new";

interface ChangelogDialogProps extends Omit<ChangelogDialogContentProps, "isWhatsNew"> {
  mode: ChangelogDialogMode | null;
}

const LazyChangelogDialogContent = lazyWithPreload<ChangelogDialogContentProps>(() =>
  import("./ChangelogDialogContent").then((module) => ({
    default: module.ChangelogDialogContent,
  })),
);

const ChangelogDialog = Object.assign(
  function ChangelogDialog({ mode, onClose, releases }: ChangelogDialogProps) {
    return (
      <Dialog onOpenChange={(open) => !open && onClose()} open={mode !== null}>
        <DialogContent className="grid max-h-[min(80dvh,48rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden sm:max-w-2xl">
          <Suspense fallback={null}>
            <LazyChangelogDialogContent
              isWhatsNew={mode === "whats-new"}
              onClose={onClose}
              releases={releases}
            />
          </Suspense>
        </DialogContent>
      </Dialog>
    );
  },
  { preload: () => LazyChangelogDialogContent.preload() },
);

export { ChangelogDialog };
