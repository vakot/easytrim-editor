import { type ComponentProps, type ReactNode, Suspense, useCallback, useState } from "react";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

import { lazyWithPreload, preloadOnIntent } from "@/lib/lazy-component";

import type { AudioTrackController } from "../../hooks/useAudioTrackController";

import { useAudioTrackMetadataDialogScope } from "./hooks/useAudioTrackMetadataDialogScope";
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
  const dialogScope = useAudioTrackMetadataDialogScope(undefined);
  const [open, setOpen] = useState(false);
  const track = controller.track;
  const stream = controller.stream;

  if (!track || !stream) return children;

  return (
    <Dialog {...dialogScope} onOpenChange={setOpen} open={open}>
      {children}

      <DialogContent {...dialogScope}>
        <Suspense fallback={null}>
          <LazyAudioTrackMetadataDialogContent controller={controller} />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

function AudioTrackMetadataDialogTrigger({
  onClick,
  onFocus,
  onPointerEnter,
  ...props
}: ComponentProps<typeof DialogTrigger>) {
  const dialogScope = useAudioTrackMetadataDialogScope(undefined);
  const preloadMetadata = useCallback(() => preloadAudioTrackMetadata(), []);

  return (
    <DialogTrigger
      {...dialogScope}
      {...props}
      onClick={onClick}
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
