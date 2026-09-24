import { createContext, useContext } from "react";

interface PreviewTransformHandlers {
  openCrop: () => void;
  resetTransform: () => void;
}

interface PreviewTransformContextValue {
  isAvailable: boolean;
  registerHandlers: (handlers: PreviewTransformHandlers) => () => void;
  requestCrop: () => void;
  requestReset: () => void;
}

const PreviewTransformContext = createContext<PreviewTransformContextValue | null>(null);

function usePreviewTransform(): PreviewTransformContextValue {
  const context = useContext(PreviewTransformContext);
  if (!context) throw new Error("usePreviewTransform must be used within PreviewTransformProvider");
  return context;
}

export { PreviewTransformContext, usePreviewTransform };
export type { PreviewTransformContextValue, PreviewTransformHandlers };
