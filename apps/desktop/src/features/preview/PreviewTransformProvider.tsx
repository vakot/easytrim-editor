import { type PropsWithChildren, useCallback, useRef, useState } from "react";

import {
  PreviewTransformContext,
  type PreviewTransformHandlers,
} from "./contexts/preview-transform-context";
import { PreviewTransformResetDialog } from "./dialogs/PreviewTransformResetDialog";

function PreviewTransformProvider({ children }: PropsWithChildren) {
  const handlersRef = useRef<PreviewTransformHandlers | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);

  const registerHandlers = useCallback((handlers: PreviewTransformHandlers) => {
    handlersRef.current = handlers;
    setIsAvailable(true);
    return () => {
      if (handlersRef.current === handlers) {
        handlersRef.current = null;
        setIsAvailable(false);
      }
    };
  }, []);

  const requestCrop = useCallback(() => handlersRef.current?.openCrop(), []);
  const requestSaveFrame = useCallback(
    () => handlersRef.current?.saveFrame() ?? Promise.resolve(),
    [],
  );

  const requestCopyFrame = useCallback(
    () => handlersRef.current?.copyFrame() ?? Promise.resolve(),
    [],
  );

  const requestReset = useCallback(() => {
    const openAfterPreload = () => setResetRequested(true);

    void PreviewTransformResetDialog.preload().then(openAfterPreload, openAfterPreload);
  }, []);

  const cancelReset = useCallback(() => setResetRequested(false), []);
  const confirmReset = useCallback(() => {
    handlersRef.current?.resetTransform();
    setResetRequested(false);
  }, []);

  return (
    <PreviewTransformContext.Provider
      value={{
        isAvailable,
        requestCopyFrame,
        registerHandlers,
        requestCrop,
        requestReset,
        requestSaveFrame,
      }}
    >
      {children}
      <PreviewTransformResetDialog
        onConfirm={confirmReset}
        onOpenChange={(open) => !open && cancelReset()}
        open={resetRequested}
      />
    </PreviewTransformContext.Provider>
  );
}

export { PreviewTransformProvider };
