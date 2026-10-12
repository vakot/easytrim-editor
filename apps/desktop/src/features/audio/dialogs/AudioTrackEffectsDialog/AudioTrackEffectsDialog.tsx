import { type ComponentProps, type ReactNode, Suspense, useCallback, useState } from "react";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

import { lazyWithPreload, preloadOnIntent } from "@/lib/lazy-component";

import type { AudioTrackEffectId } from "../../components/AudioTrack/components/AudioTrackEffectsLibrary/consts/audio-track-effects";
import type { AudioTrackController } from "../../hooks/useAudioTrackController";

import { useAudioTrackEffectsDialogScope } from "./hooks/useAudioTrackEffectsDialogScope";
import type { AudioTrackEffectsDialogContent } from "./AudioTrackEffectsDialogContent";
import {
  AudioTrackEffectsDialogContext,
  useAudioTrackEffectsDialog,
} from "./AudioTrackEffectsDialogContext";

const LazyAudioTrackEffectsDialogContent = lazyWithPreload<
  ComponentProps<typeof AudioTrackEffectsDialogContent>
>(() =>
  import("./AudioTrackEffectsDialogContent").then((module) => ({
    default: module.AudioTrackEffectsDialogContent,
  })),
);

function preloadAudioTrackEffects(initialView?: AudioTrackEffectId) {
  preloadOnIntent(async () => {
    const [, { AUDIO_TRACK_EFFECTS }] = await Promise.all([
      LazyAudioTrackEffectsDialogContent.preload(),
      import("../../components/AudioTrack/components/AudioTrackEffectsLibrary/consts/audio-track-effects"),
    ]);

    const effect =
      AUDIO_TRACK_EFFECTS.find(({ id }) => id === initialView) ??
      AUDIO_TRACK_EFFECTS.find(
        (candidate) => "defaultSelected" in candidate && candidate.defaultSelected,
      );

    await effect?.preload();
  })();
}

function AudioTrackEffectsDialog({
  children,
  controller,
}: {
  children: ReactNode;
  controller: AudioTrackController;
}) {
  const dialogScope = useAudioTrackEffectsDialogScope(undefined);
  const [open, setOpen] = useState(false);
  const [initialView, setInitialView] = useState<AudioTrackEffectId | undefined>();
  const track = controller.track;
  const stream = controller.stream;

  const selectEffectsView = useCallback((view?: AudioTrackEffectId) => {
    setInitialView(view);
  }, []);

  if (!track || !stream) return children;

  return (
    <AudioTrackEffectsDialogContext.Provider value={{ selectEffectsView }}>
      <Dialog {...dialogScope} onOpenChange={setOpen} open={open}>
        {children}

        <DialogContent
          {...dialogScope}
          className="h-full max-h-[min(80dvh,32rem)] grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-0 overflow-hidden p-0 sm:max-w-3xl"
        >
          <Suspense fallback={null}>
            <LazyAudioTrackEffectsDialogContent
              controller={controller}
              initialProcessing={track.processing}
              initialView={initialView}
            />
          </Suspense>
        </DialogContent>
      </Dialog>
    </AudioTrackEffectsDialogContext.Provider>
  );
}

function AudioTrackEffectsDialogTrigger({
  initialView,
  onClick,
  onFocus,
  onPointerEnter,
  ...props
}: ComponentProps<typeof DialogTrigger> & { initialView?: AudioTrackEffectId }) {
  const dialogScope = useAudioTrackEffectsDialogScope(undefined);
  const { selectEffectsView } = useAudioTrackEffectsDialog();

  const preloadEffects = useCallback((view?: AudioTrackEffectId) => {
    preloadAudioTrackEffects(view);
  }, []);

  return (
    <DialogTrigger
      {...dialogScope}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) selectEffectsView(initialView);
      }}
      onFocus={(event) => {
        preloadEffects(initialView);
        onFocus?.(event);
      }}
      onPointerEnter={(event) => {
        preloadEffects(initialView);
        onPointerEnter?.(event);
      }}
    />
  );
}

export { AudioTrackEffectsDialog, AudioTrackEffectsDialogTrigger };
