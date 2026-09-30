import { createContext, type RefObject, useContext } from "react";

interface PreviewRuntimeContract {
  isPreviewReady: boolean;
  onCanPlay: () => void;
  onPreviewPlaybackError: (previewKind: "source" | "proxy") => void;
  previewKey: string | null;
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
export type { PreviewRuntimeContract };
