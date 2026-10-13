import { createContext, type RefObject, useContext } from "react";

interface PreviewMediaObserver {
  onEnded: () => void;
  onPause: () => void;
  onPlay: () => void;
  onPlaybackError: () => void;
  onTimeUpdate: (seconds: number) => void;
}

interface PreviewPlaybackFrame {
  cancel: () => void;
}

interface PreviewRuntimeContract {
  isPreviewReady: boolean;
  isSeekPending: () => boolean;
  onCanPlay: () => void;
  onEnded: () => void;
  onPause: () => void;
  onPlay: () => void;
  onPlaybackError: () => void;
  onPreviewPlaybackError: (previewKind: "source" | "proxy") => void;
  onTimeUpdate: (seconds: number) => void;
  pauseMedia: () => void;
  playMedia: () => Promise<void>;
  previewKey: string | null;
  registerMediaObserver: (observer: PreviewMediaObserver) => () => void;
  requestPlaybackFrame: (
    callback: (timestamp: number, mediaTimeSeconds: number) => void,
  ) => PreviewPlaybackFrame | null;
  seekMedia: (seconds: number, approximate: boolean, onSettled?: () => void) => void;
  setPlaybackRate: (rate: number) => void;
  setVideoElement: (element: HTMLVideoElement | null) => void;
  videoRef: RefObject<HTMLVideoElement | null>;
}

const PreviewRuntimeContext = createContext<PreviewRuntimeContract | null>(null);

function usePreviewRuntime(): PreviewRuntimeContract {
  const runtime = useContext(PreviewRuntimeContext);
  if (!runtime) throw new Error("Preview runtime must be used within PreviewPlaybackProvider.");
  return runtime;
}

export { PreviewRuntimeContext, usePreviewRuntime };
export type { PreviewMediaObserver, PreviewPlaybackFrame, PreviewRuntimeContract };
