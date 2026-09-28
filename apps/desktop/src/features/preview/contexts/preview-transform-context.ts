import { createContext, useContext } from "react";

interface PreviewTransformHandlers {
  copyFrame: () => Promise<void>;
  openCrop: () => void;
  resetTransform: () => void;
  saveFrame: () => Promise<void>;
}

interface PreviewTransformContextValue {
  isAvailable: boolean;
  registerHandlers: (handlers: PreviewTransformHandlers) => () => void;
  requestCopyFrame: () => Promise<void>;
  requestCrop: () => void;
  requestReset: () => void;
  requestSaveFrame: () => Promise<void>;
}

const PreviewTransformContext = createContext<PreviewTransformContextValue | null>(null);

function usePreviewTransform(): PreviewTransformContextValue {
  const context = useContext(PreviewTransformContext);
  if (!context) throw new Error("usePreviewTransform must be used within PreviewTransformProvider");
  return context;
}

export { PreviewTransformContext, usePreviewTransform };
export type { PreviewTransformContextValue, PreviewTransformHandlers };
