import {
  type ComponentProps,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useState,
} from "react";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

import { useAppStore } from "@/app/store/redux-hooks";
import { selectAudioTracks } from "@/app/store/slices/audio-slice";
import { lazyWithPreload, preloadOnIntent } from "@/lib/lazy-component";

import { AudioFiltersPreloadContext } from "./contexts/audio-filters-preload-context";
import { useAudioTrackFiltersDialogScope } from "./hooks/useAudioTrackFiltersDialogScope";
import { preloadAudioFilterPage, preloadAudioSyncOffsetPage } from "./lib/audio-filter-pages";
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

/**
 * The Audio Filters Library of one track. Its draft lives only while the dialog is open, and
 * playback auditions it meanwhile, so the playback shortcuts stay available.
 */
function AudioTrackFiltersDialog({
  children,
  streamIndex,
}: {
  children: ReactNode;
  streamIndex: number;
}) {
  const dialogScope = useAudioTrackFiltersDialogScope(undefined);
  const store = useAppStore();
  const [open, setOpen] = useState(false);

  // The dialog opens on the first filter of the committed chain, so that page loads together with
  // the dialog. The chain is read when the intent happens, so it needs no subscription.
  const preload = useCallback(() => {
    preloadAudioTrackFilters();
    const track = selectAudioTracks(store.getState()).find(
      (track) => track.streamIndex === streamIndex,
    );

    const firstFilter = track?.processing.filters[0];

    if (firstFilter) preloadAudioFilterPage(firstFilter.type);
    if (track?.processing.syncOffset) preloadAudioSyncOffsetPage();
  }, [store, streamIndex]);

  return (
    <Dialog {...dialogScope} onOpenChange={setOpen} open={open}>
      <AudioFiltersPreloadContext.Provider value={preload}>
        {children}
      </AudioFiltersPreloadContext.Provider>

      <DialogContent
        {...dialogScope}
        className="h-full max-h-[min(85dvh,36rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-3xl"
        data-playback-shortcuts=""
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
  const preloadFilters = useContext(AudioFiltersPreloadContext);

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
