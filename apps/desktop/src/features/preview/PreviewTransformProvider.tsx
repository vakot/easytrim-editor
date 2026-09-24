import { type PropsWithChildren, useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  PreviewTransformContext,
  type PreviewTransformHandlers,
} from "./contexts/preview-transform-context";

function PreviewTransformProvider({ children }: PropsWithChildren) {
  const { t } = useTranslation();
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
  const requestReset = useCallback(() => setResetRequested(true), []);
  const cancelReset = useCallback(() => setResetRequested(false), []);
  const confirmReset = useCallback(() => {
    handlersRef.current?.resetTransform();
    setResetRequested(false);
  }, []);

  return (
    <PreviewTransformContext.Provider
      value={{
        isAvailable,
        registerHandlers,
        requestCrop,
        requestReset,
      }}
    >
      {children}
      <AlertDialog onOpenChange={(open) => !open && cancelReset()} open={resetRequested}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("preview.dialogs.reset.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("preview.dialogs.reset.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReset} variant="destructive">
              {t("preview.actions.transform.reset")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PreviewTransformContext.Provider>
  );
}

export { PreviewTransformProvider };
