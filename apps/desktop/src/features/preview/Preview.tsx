import { LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { usePlayback } from "@/app/hooks/usePlayback";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectPreview } from "@/app/store/slices/preview-slice";
import { selectSourceSelection } from "@/app/store/slices/source-slice";

import { VideoPreview } from "./components/VideoPreview";
import { VideoPreviewEmpty } from "./components/VideoPreviewEmpty";

export function Preview() {
  const { t } = useTranslation();
  const playback = usePlayback();
  const sourceSelection = useAppSelector(selectSourceSelection);
  const preview = useAppSelector(selectPreview);
  const showLoadingOverlay =
    sourceSelection !== null &&
    (preview.status === "loading" ||
      (preview.status === "ready" && !playback.isReady && !playback.isPlaying));

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
          data-testid="editor-loading-overlay"
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
          </div>
        </div>
      ) : null}
    </>
  );
}
