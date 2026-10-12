import { type ComponentProps, type ReactNode, Suspense, useCallback, useState } from "react";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

import { lazyWithPreload, preloadOnIntent } from "@/lib/lazy-component";

import type { AudioTrackController } from "../../hooks/useAudioTrackController";

import {
  AudioTrackMetadataDialogContext,
  useAudioTrackMetadataDialog,
} from "./contexts/audio-track-metadata-dialog-context";
import type { AudioTrackMetadataDialogContent } from "./AudioTrackMetadataDialogContent";

const LazyAudioTrackMetadataDialogContent = lazyWithPreload<
  ComponentProps<typeof AudioTrackMetadataDialogContent>
>(() =>
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
  const track = controller.track;
  const stream = controller.stream;

  const preloadMetadata = useCallback(() => preloadAudioTrackMetadata(), []);
  const openMetadataDialog = useCallback(async () => {
    await LazyAudioTrackMetadataDialogContent.preload();
    setOpen(true);
  }, []);

  if (!track || !stream) return children;

  return (
    <AudioTrackMetadataDialogContext.Provider value={{ openMetadataDialog, preloadMetadata }}>
      {children}

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <Suspense fallback={null}>
            <LazyAudioTrackMetadataDialogContent controller={controller} />
          </Suspense>
        </DialogContent>
      </Dialog>
    </AudioTrackMetadataDialogContext.Provider>
  );
}

function AudioTrackMetadataDialogTrigger({
  onClick,
  onFocus,
  onPointerEnter,
  ...props
}: ComponentProps<typeof DialogTrigger>) {
  const { openMetadataDialog, preloadMetadata } = useAudioTrackMetadataDialog();

  return (
    <DialogTrigger
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        void openMetadataDialog();
      }}
      onFocus={(event) => {
        preloadMetadata();
        onFocus?.(event);
      }}
      onPointerEnter={(event) => {
        preloadMetadata();
        onPointerEnter?.(event);
      }}
    />
  );
}

export { AudioTrackMetadataDialog, AudioTrackMetadataDialogTrigger };
