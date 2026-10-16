import { X } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Provider as ReduxProvider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";

import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ResizablePanelContextProvider } from "@/components/ui/resizable";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { NativeDialogOverlay } from "@/app/components/NativeDialogOverlay";
import { WorkspaceRecoveryNotice } from "@/app/components/WorkspaceRecoveryNotice";
import { AppChangelogDialog } from "@/app/dialogs/AppChangelogDialog";
import { AppChaptersDialog } from "@/app/dialogs/AppChaptersDialog";
import { AppCommandPaletteDialog } from "@/app/dialogs/AppCommandPaletteDialog";
import { AppDiagnosticsRecoveryDialog } from "@/app/dialogs/AppDiagnosticsRecoveryDialog";
import { AppSettingsDialog } from "@/app/dialogs/AppSettingsDialog";
import { AppShutdownGuardDialog } from "@/app/dialogs/AppShutdownGuardDialog";
import { AppStatisticsDialog } from "@/app/dialogs/AppStatisticsDialog";
import { AppLayout } from "@/app/layout";
import { AppDialogsProvider } from "@/app/providers/AppDialogsProvider";
import { ApplicationCommandsProvider } from "@/app/providers/ApplicationCommandsProvider";
import { AppUpdatesProvider } from "@/app/providers/AppUpdatesProvider";
import { EditorRuntimeProviders } from "@/app/providers/EditorRuntimeProviders";
import { LayoutDensityProvider } from "@/app/providers/LayoutDensityProvider";
import { UiScaleFeedbackProvider } from "@/app/providers/UiScaleFeedbackProvider";
import { WorkspaceViewsProvider } from "@/app/providers/WorkspaceViewsProvider";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  dropListenerErrorCleared,
  selectDropListenerError,
} from "@/app/store/slices/import-workflow-slice";
import { persistor, store } from "@/app/store/store";
import { loadQueueFinishActions } from "@/app/store/thunks/queue-finish-thunks";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { ActivityToasts } from "@/features/activity";
import { ExportDialog, QueueDeleteSourceProvider } from "@/features/export";
import { PreviewTransformProvider } from "@/features/preview";
import { SourceDeleteProvider, SourceDropOverlay } from "@/features/source";
import { localizeAppError } from "@/i18n/app-errors";

function EasyTrimEditorApp() {
  const { t } = useTranslation();

  const dispatch = useAppDispatch();
  const dropListenerError = useAppSelector(selectDropListenerError);

  useEffect(() => {
    void dispatch(loadQueueFinishActions());
  }, [dispatch]);

  return (
    <TooltipProvider>
      <SourceDeleteProvider>
        <QueueDeleteSourceProvider>
          <PreviewTransformProvider>
            <AppShutdownGuardDialog />

            <AppUpdatesProvider>
              <EditorRuntimeProviders>
                <ResizablePanelContextProvider>
                  <AppDialogsProvider>
                    <UiScaleFeedbackProvider>
                      <ApplicationCommandsProvider>
                        <ExportDialog>
                          <AppLayout />
                        </ExportDialog>
                        <AppSettingsDialog />
                        <AppCommandPaletteDialog />
                        <AppChangelogDialog />
                        <AppChaptersDialog />
                        <AppStatisticsDialog />

                        <Toaster />
                        <ActivityToasts />
                        <AppDiagnosticsRecoveryDialog />
                        <WorkspaceRecoveryNotice />
                        <SourceDropOverlay />
                        <NativeDialogOverlay />

                        {dropListenerError ? (
                          <Alert
                            className="fixed top-20 left-1/2 z-50 w-auto -translate-x-1/2"
                            variant="destructive"
                          >
                            <AlertDescription>
                              {t("app.dragUnavailable", {
                                message: localizeAppError(dropListenerError, t),
                              })}
                            </AlertDescription>
                            <AlertAction>
                              <Button
                                aria-label={t("app.actions.dismiss")}
                                onClick={() => dispatch(dropListenerErrorCleared())}
                                size="icon-sm"
                                type="button"
                                variant="ghost"
                              >
                                <X aria-hidden="true" />
                              </Button>
                            </AlertAction>
                          </Alert>
                        ) : null}
                      </ApplicationCommandsProvider>
                    </UiScaleFeedbackProvider>
                  </AppDialogsProvider>
                </ResizablePanelContextProvider>
              </EditorRuntimeProviders>
            </AppUpdatesProvider>
          </PreviewTransformProvider>
        </QueueDeleteSourceProvider>
      </SourceDeleteProvider>
    </TooltipProvider>
  );
}

function App() {
  return (
    <ReduxProvider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ThemeProvider>
          <LayoutDensityProvider>
            <WorkspaceViewsProvider>
              <EasyTrimEditorApp />
            </WorkspaceViewsProvider>
          </LayoutDensityProvider>
        </ThemeProvider>
      </PersistGate>
    </ReduxProvider>
  );
}

export { App };
