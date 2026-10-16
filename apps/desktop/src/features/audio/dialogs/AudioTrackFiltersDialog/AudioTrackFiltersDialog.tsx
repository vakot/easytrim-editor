import { type ComponentProps, type ReactNode, Suspense, useCallback, useState } from "react";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

import { lazyWithPreload, preloadOnIntent } from "@/lib/lazy-component";

import { useAudioTrackFiltersDialogScope } from "./hooks/useAudioTrackFiltersDialogScope";
import type { AudioTrackFiltersDialogContent } from "./AudioTrackFiltersDialogContent";

const LazyAudioTrackFiltersDialogContent = lazyWithPreload<
  ComponentProps<typeof AudioTrackFiltersDialogContent>
>(() =>
  import("./AudioTrackFiltersDialogContent").then((module) => ({
    default: module.AudioTrackFiltersDialogContent,
  })),
);

const preloadAudioTrackFilters = preloadOnIntent(() =>
  LazyAudioTrackFiltersDialogContent.preload(),
);

/** The Audio Filters Library of one track. Its draft lives only while the dialog is open. */
function AudioTrackFiltersDialog({
  children,
  streamIndex,
}: {
  children: ReactNode;
  streamIndex: number;
}) {
  const dialogScope = useAudioTrackFiltersDialogScope(undefined);
  const [open, setOpen] = useState(false);

  return (
    <Dialog {...dialogScope} onOpenChange={setOpen} open={open}>
      {children}

      <DialogContent
        {...dialogScope}
        className="h-full max-h-[min(85dvh,36rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        <Suspense fallback={null}>
          <LazyAudioTrackFiltersDialogContent
            onClose={() => setOpen(false)}
            streamIndex={streamIndex}
          />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

function AudioTrackFiltersDialogTrigger({
  onFocus,
  onPointerEnter,
  ...props
}: ComponentProps<typeof DialogTrigger>) {
  const dialogScope = useAudioTrackFiltersDialogScope(undefined);
  const preloadFilters = useCallback(() => preloadAudioTrackFilters(), []);

  return (
    <DialogTrigger
      {...dialogScope}
      {...props}
      onFocus={(event) => {
        preloadFilters();
        onFocus?.(event);
      }}
      onPointerEnter={(event) => {
        preloadFilters();
        onPointerEnter?.(event);
      }}
    />
  );
}

export { AudioTrackFiltersDialog, AudioTrackFiltersDialogTrigger };
