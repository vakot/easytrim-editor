import { usePlayback } from "@/app/hooks/usePlayback";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectPreview } from "@/app/store/slices/preview-slice";
import { selectSourceSelection } from "@/app/store/slices/source-slice";
import { closeActiveImportedItemRequested } from "@/app/store/thunks/source-media-thunks";

import { VideoPreview } from "./components/VideoPreview";
import { VideoPreviewEmpty } from "./components/VideoPreviewEmpty";
import { VideoPreviewLoadingOverlay } from "./components/VideoPreviewLoadingOverlay";

export function Preview() {
  const dispatch = useAppDispatch();
  const playback = usePlayback();
  const sourceSelection = useAppSelector(selectSourceSelection);
  const preview = useAppSelector(selectPreview);

  const skipCurrentSource = () => void dispatch(closeActiveImportedItemRequested());

  return (
    <div className="relative size-full min-h-0 overflow-hidden" data-slot="preview-content">
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

      <VideoPreviewLoadingOverlay onSkip={skipCurrentSource} />
    </div>
  );
}
