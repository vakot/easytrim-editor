import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Provider as ReduxProvider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResizablePanelContextProvider } from "@/components/ui/resizable";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AppShutdownGuard } from "@/app/components/AppShutdownGuard";
import { DiagnosticsRecoveryDialog } from "@/app/components/DiagnosticsRecoveryDialog";
import { NativeDialogOverlay } from "@/app/components/NativeDialogOverlay";
import { AppLayout } from "@/app/layout";
import { AppUpdatesProvider } from "@/app/providers/AppUpdatesProvider";
import { EditorContractsProvider } from "@/app/providers/EditorContractsProvider";
import { LayoutDensityProvider } from "@/app/providers/LayoutDensityProvider";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectDropListenerError } from "@/app/store/slices/import-workflow-slice";
import { persistor, store } from "@/app/store/store";
import { loadQueueFinishActions } from "@/app/store/thunks/export-thunks";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { ActivityToasts } from "@/features/activity";
import { ChangelogProvider } from "@/features/changelog";
import { ExportDialog } from "@/features/export";
import { SourceDropOverlay } from "@/features/source";

function EasyTrimEditorApp() {
  const { t } = useTranslation();

  const dispatch = useAppDispatch();
  const dropListenerError = useAppSelector(selectDropListenerError);

  useEffect(() => {
    void dispatch(loadQueueFinishActions());
  }, [dispatch]);

  return (
    <TooltipProvider>
      <ChangelogProvider>
        <AppShutdownGuard />

        <AppUpdatesProvider>
          <EditorContractsProvider>
            <ResizablePanelContextProvider>
              <AppLayout />

              <Toaster />
              <ActivityToasts />
              <ExportDialog />
              <DiagnosticsRecoveryDialog />
              <SourceDropOverlay />
              <NativeDialogOverlay />

              {dropListenerError ? (
                <Alert
                  className="fixed top-20 left-1/2 z-50 w-auto -translate-x-1/2"
                  variant="destructive"
                >
                  <AlertDescription>
                    {t("app.messages.dragUnavailable", { message: dropListenerError.message })}
                  </AlertDescription>
                </Alert>
              ) : null}
            </ResizablePanelContextProvider>
          </EditorContractsProvider>
        </AppUpdatesProvider>
      </ChangelogProvider>
    </TooltipProvider>
  );
}

function App() {
  return (
    <ReduxProvider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ThemeProvider>
          <LayoutDensityProvider>
            <EasyTrimEditorApp />
          </LayoutDensityProvider>
        </ThemeProvider>
      </PersistGate>
    </ReduxProvider>
  );
}

export { App };
