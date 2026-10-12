import { type ComponentProps, type ReactNode, Suspense, useCallback, useState } from "react";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

import { lazyWithPreload, preloadOnIntent } from "@/lib/lazy-component";

import type { AudioTrackEffectId } from "../../components/AudioTrack/components/AudioTrackEffectsLibrary/consts/audio-track-effects";
import type { AudioTrackController } from "../../hooks/useAudioTrackController";

import {
  AudioTrackEffectsDialogContext,
  useAudioTrackEffectsDialog,
} from "./contexts/audio-track-effects-dialog-context";
import type { AudioTrackEffectsDialogContent } from "./AudioTrackEffectsDialogContent";

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

interface AudioTrackEffectsDialogProps {
  children: ReactNode;
  controller: AudioTrackController;
}

function AudioTrackEffectsDialog({ children, controller }: AudioTrackEffectsDialogProps) {
  const [open, setOpen] = useState(false);
  const [initialView, setInitialView] = useState<AudioTrackEffectId | undefined>();
  const track = controller.track;
  const stream = controller.stream;

  const preloadEffects = useCallback((view?: AudioTrackEffectId) => {
    preloadAudioTrackEffects(view);
  }, []);

  const openEffects = useCallback(async (view?: AudioTrackEffectId) => {
    setInitialView(view);
    await LazyAudioTrackEffectsDialogContent.preload();
    setOpen(true);
  }, []);

  if (!track || !stream) return children;

  return (
    <AudioTrackEffectsDialogContext.Provider value={{ openEffects, preloadEffects }}>
      {children}

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="h-full max-h-[min(80dvh,32rem)] grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-0 overflow-hidden p-0 sm:max-w-3xl">
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
  const { openEffects, preloadEffects } = useAudioTrackEffectsDialog();

  return (
    <DialogTrigger
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        void openEffects(initialView);
      }}
      onFocus={(event) => {
        preloadEffects();
        onFocus?.(event);
      }}
      onPointerEnter={(event) => {
        preloadEffects();
        onPointerEnter?.(event);
      }}
    />
  );
}

export { AudioTrackEffectsDialog, AudioTrackEffectsDialogTrigger };
