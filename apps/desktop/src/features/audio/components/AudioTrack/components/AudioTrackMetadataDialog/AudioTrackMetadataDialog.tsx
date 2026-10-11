import { type ReactNode, Suspense, useCallback, useState } from "react";

import { Dialog } from "@/components/ui/dialog";

import { lazyWithPreload, preloadOnIntent } from "@/lib/lazy-component";

import type { AudioTrackController } from "../../../../hooks/useAudioTrackController";

import { AudioTrackMetadataDialogContext } from "./contexts/audio-track-metadata-dialog-context";
import type { AudioTrackMetadataDialogContentProps } from "./AudioTrackMetadataDialogContent";

const LazyAudioTrackMetadataDialogContent = lazyWithPreload<AudioTrackMetadataDialogContentProps>(
  () =>
    import("./AudioTrackMetadataDialogContent").then((module) => ({
      default: module.AudioTrackMetadataDialogContent,
    })),
);

const preloadAudioTrackMetadata = preloadOnIntent(() =>
  LazyAudioTrackMetadataDialogContent.preload(),
);

function AudioTrackMetadataDialog({
  children,
  controller,
}: {
  children: ReactNode;
  controller: AudioTrackController;
}) {
  const [open, setOpen] = useState(false);
  const [dialogSession, setDialogSession] = useState(0);
  const track = controller.track;
  const stream = controller.stream;

  const preloadMetadata = useCallback(() => preloadAudioTrackMetadata(), []);
  const openMetadataDialog = useCallback(() => {
    setDialogSession((session) => session + 1);
    preloadAudioTrackMetadata();
    setOpen(true);
  }, []);

  const closeMetadataDialog = useCallback(() => setOpen(false), []);

  if (!track || !stream) return children;

  return (
    <AudioTrackMetadataDialogContext.Provider
      value={{ closeMetadataDialog, openMetadataDialog, preloadMetadata }}
    >
      {children}

      <Dialog onOpenChange={setOpen} open={open}>
        {open ? (
          <Suspense fallback={null}>
            <LazyAudioTrackMetadataDialogContent controller={controller} key={dialogSession} />
          </Suspense>
        ) : null}
      </Dialog>
    </AudioTrackMetadataDialogContext.Provider>
  );
}

export { AudioTrackMetadataDialog };
