import { type ComponentProps, type ReactNode, Suspense, useCallback, useState } from "react";

import { lazyWithPreload, preloadOnIntent } from "@easytrim-editor/ui/lazy-component";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

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
  streamIndex,
}: {
  children: ReactNode;
  streamIndex: number;
}) {
  const dialogScope = useAudioTrackMetadataDialogScope(undefined);
  const [open, setOpen] = useState(false);

  return (
    <Dialog {...dialogScope} onOpenChange={setOpen} open={open}>
      {children}

      <DialogContent {...dialogScope}>
        <Suspense fallback={null}>
          <LazyAudioTrackMetadataDialogContent
            onClose={() => setOpen(false)}
            streamIndex={streamIndex}
          />
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
