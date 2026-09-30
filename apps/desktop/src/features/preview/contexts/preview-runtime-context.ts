import { createContext, type RefObject, useContext } from "react";

interface PreviewMediaObserver {
  onEnded: () => void;
  onLoadedMetadata: () => void;
  onPause: () => void;
  onPlay: () => void;
  onPlaybackError: () => void;
  onTimeUpdate: (seconds: number) => void;
}

interface PreviewMediaState {
  currentTimeSeconds: number;
  paused: boolean;
  seeking: boolean;
}

interface PreviewPlaybackFrame {
  cancel: () => void;
}

interface PreviewRuntimeContract {
  getMediaState: () => PreviewMediaState | null;
  isNativeLoopEnabled: boolean;
  isPreviewReady: boolean;
  isSeekPending: () => boolean;
  onCanPlay: () => void;
  onEnded: () => void;
  onLoadedMetadata: () => void;
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
  setNativeLoopEnabled: (enabled: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setVideoElement: (element: HTMLVideoElement | null) => void;
  videoRef: RefObject<HTMLVideoElement | null>;
}

type PreviewMediaTransportContract = Pick<
  PreviewRuntimeContract,
  | "getMediaState"
  | "isNativeLoopEnabled"
  | "isPreviewReady"
  | "isSeekPending"
  | "pauseMedia"
  | "playMedia"
  | "previewKey"
  | "registerMediaObserver"
  | "requestPlaybackFrame"
  | "seekMedia"
  | "setNativeLoopEnabled"
  | "setPlaybackRate"
>;

const PreviewRuntimeContext = createContext<PreviewRuntimeContract | null>(null);

function usePreviewRuntime(): PreviewRuntimeContract {
  const runtime = useContext(PreviewRuntimeContext);
  if (!runtime) throw new Error("Preview runtime must be used within PreviewPlaybackProvider.");
  return runtime;
}

function usePreviewMediaTransport(): PreviewMediaTransportContract {
  const runtime = usePreviewRuntime();
  return {
    getMediaState: runtime.getMediaState,
    isNativeLoopEnabled: runtime.isNativeLoopEnabled,
    isPreviewReady: runtime.isPreviewReady,
    isSeekPending: runtime.isSeekPending,
    pauseMedia: runtime.pauseMedia,
    playMedia: runtime.playMedia,
    previewKey: runtime.previewKey,
    registerMediaObserver: runtime.registerMediaObserver,
    requestPlaybackFrame: runtime.requestPlaybackFrame,
    seekMedia: runtime.seekMedia,
    setNativeLoopEnabled: runtime.setNativeLoopEnabled,
    setPlaybackRate: runtime.setPlaybackRate,
  };
}

export { PreviewRuntimeContext, usePreviewMediaTransport, usePreviewRuntime };
export type {
  PreviewMediaObserver,
  PreviewMediaState,
  PreviewPlaybackFrame,
  PreviewRuntimeContract,
};
