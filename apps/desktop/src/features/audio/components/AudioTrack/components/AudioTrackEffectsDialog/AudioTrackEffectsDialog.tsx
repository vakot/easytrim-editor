import { type ReactNode, Suspense, useCallback, useState } from "react";

import { Dialog } from "@/components/ui/dialog";

import { lazyWithPreload, preloadOnIntent } from "@/lib/lazy-component";

import type { AudioTrackController } from "../../../../hooks/useAudioTrackController";
import type { AudioTrackEffectId } from "../AudioTrackEffectsLibrary/consts/audio-track-effects";

import { AudioTrackEffectsDraftProvider } from "./components/AudioTrackEffectsDraftProvider";
import { AudioTrackEffectsDialogContext } from "./contexts/audio-track-effects-dialog-context";
import type { AudioTrackEffectsDialogContentProps } from "./AudioTrackEffectsDialogContent";

const LazyAudioTrackEffectsDialogContent = lazyWithPreload<AudioTrackEffectsDialogContentProps>(
  () =>
    import("./AudioTrackEffectsDialogContent").then((module) => ({
      default: module.AudioTrackEffectsDialogContent,
    })),
);

const preloadAudioTrackEffects = preloadOnIntent(() =>
  LazyAudioTrackEffectsDialogContent.preload(),
);

interface AudioTrackEffectsDialogProps {
  children: ReactNode;
  controller: AudioTrackController;
}

function AudioTrackEffectsDialog({ children, controller }: AudioTrackEffectsDialogProps) {
  const [open, setOpen] = useState(false);
  const [draftSession, setDraftSession] = useState(0);
  const [initialView, setInitialView] = useState<AudioTrackEffectId | undefined>();
  const track = controller.track;
  const stream = controller.stream;

  const preloadEffects = useCallback(() => {
    preloadAudioTrackEffects();
  }, []);

  const openEffects = useCallback((view?: AudioTrackEffectId) => {
    setInitialView(view);
    setDraftSession((session) => session + 1);
    preloadAudioTrackEffects();
    setOpen(true);
  }, []);

  if (!track || !stream) return children;

  return (
    <AudioTrackEffectsDialogContext.Provider value={{ openEffects, preloadEffects }}>
      {children}

      <Dialog onOpenChange={setOpen} open={open}>
        {open ? (
          <Suspense fallback={null}>
            <AudioTrackEffectsDraftProvider initialProcessing={track.processing} key={draftSession}>
              <LazyAudioTrackEffectsDialogContent
                controller={controller}
                initialView={initialView}
              />
            </AudioTrackEffectsDraftProvider>
          </Suspense>
        ) : null}
      </Dialog>
    </AudioTrackEffectsDialogContext.Provider>
  );
}

export { AudioTrackEffectsDialog };
