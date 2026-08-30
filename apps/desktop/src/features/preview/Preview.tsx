import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { usePlayback } from "@/app/hooks/usePlayback";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectPreview } from "@/app/store/slices/preview-slice";
import { selectSourceLoadToken, selectSourceSelection } from "@/app/store/slices/source-slice";
import { closeActiveImportedItemRequested } from "@/app/store/thunks/source-media-thunks";

import { VideoPreview } from "./components/VideoPreview";
import { VideoPreviewEmpty } from "./components/VideoPreviewEmpty";

export function Preview() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const playback = usePlayback();
  const sourceSelection = useAppSelector(selectSourceSelection);
  const sourceLoadToken = useAppSelector(selectSourceLoadToken);
  const preview = useAppSelector(selectPreview);
  const transitionKey = `${sourceLoadToken}:${sourceSelection?.sourcePath ?? "no-source"}`;
  const [completedTransitionKey, setCompletedTransitionKey] = useState<string | null>(null);
  const showLoadingOverlay =
    sourceSelection !== null &&
    (preview.status === "loading" ||
      (preview.status === "ready" &&
        completedTransitionKey !== transitionKey &&
        !playback.isReady));

  const [skipAvailableFor, setSkipAvailableFor] = useState<string | null>(null);

  useEffect(() => {
    if (sourceSelection !== null && preview.status === "ready" && playback.isReady) {
      // Playback becoming ready completes this source transition. Later audio-route
      // reconfiguration must not revive the source-opening overlay.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompletedTransitionKey(transitionKey);
    }
  }, [playback.isReady, preview.status, sourceSelection, transitionKey]);

  useEffect(() => {
    if (!showLoadingOverlay) return;
    const timeout = window.setTimeout(() => setSkipAvailableFor(transitionKey), 3_000);
    return () => window.clearTimeout(timeout);
  }, [showLoadingOverlay, transitionKey]);

  const skipCurrentSource = () => void dispatch(closeActiveImportedItemRequested());

  return (
    <>
      {sourceSelection === null ? (
        <VideoPreviewEmpty />
      ) : (
        <VideoPreview
          muted={playback.videoMuted}
          nativeLoopEnabled={playback.nativeLoopEnabled}
          onCanPlay={playback.onCanPlay}
          onCropToolOpenChange={playback.onCropToolOpenChange}
          onEnded={playback.onEnded}
          onLoadedMetadata={playback.onLoadedMetadata}
          onPause={playback.onPause}
          onPlay={playback.onPlay}
          onPlaybackError={playback.onPreviewPlaybackError}
          onSkip={skipCurrentSource}
          onTimeUpdate={playback.onTimeUpdate}
          onTogglePlayback={playback.toggle}
          preview={preview}
          videoRef={playback.videoRef}
        />
      )}
      {showLoadingOverlay ? (
        <div
          aria-live="polite"
          className="absolute inset-0 z-30 grid place-items-center bg-background/75 backdrop-blur-sm"
          data-testid="preview-loading-overlay"
          role="status"
        >
          <div className="grid place-items-center gap-2 text-center text-sm text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-7 animate-spin text-primary" />
            <strong className="text-foreground">
              {preview.status === "loading" && preview.kind === "proxy"
                ? t("preview.status.preparing")
                : preview.status === "loading"
                  ? t("preview.status.opening")
                  : t("common.status.loading")}
            </strong>
            {skipAvailableFor === transitionKey ? (
              <Button onClick={skipCurrentSource} size="sm" variant="outline">
                {t("queue.actions.skip")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
