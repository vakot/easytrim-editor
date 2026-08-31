import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Provider as ReduxProvider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResizablePanelContextProvider } from "@/components/ui/resizable";
import { TooltipProvider } from "@/components/ui/tooltip";

import { CustomTitleBar } from "@/app/components/CustomTitleBar";
import { DiagnosticsRecoveryDialog } from "@/app/components/DiagnosticsRecoveryDialog";
import { EditorWorkspace } from "@/app/components/editor-workspace/EditorWorkspace";
import { MenuBar } from "@/app/components/menu-bar";
import { NativeDialogOverlay } from "@/app/components/NativeDialogOverlay";
import { PanelVisibilityControls } from "@/app/components/PanelVisibilityControls";
import { AppUpdatesProvider } from "@/app/components/providers/AppUpdatesProvider";
import { EditorContractsProvider } from "@/app/components/providers/EditorContractsProvider";
import { StatusBar } from "@/app/components/status-bar";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectDropListenerError } from "@/app/store/slices/import-workflow-slice";
import { persistor, store } from "@/app/store/store";
import { loadQueueFinishActions } from "@/app/store/thunks/export-thunks";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { ExportDialog } from "@/features/export";
import { SourceDropOverlay, SourceStatus } from "@/features/source";

function EasyTrimEditorApp() {
  const dispatch = useAppDispatch();
  const dropListenerError = useAppSelector(selectDropListenerError);
  const { t } = useTranslation();

  useEffect(() => {
    void dispatch(loadQueueFinishActions());
  }, [dispatch]);

  return (
    <TooltipProvider>
      <main className="fixed inset-0 grid h-dvh w-screen min-w-80 grid-rows-[2.25rem_minmax(0,1fr)_auto] overflow-hidden bg-background">
        <CustomTitleBar
          menuControls={<MenuBar />}
          panelControls={<PanelVisibilityControls />}
          statusContent={<SourceStatus />}
        />

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

        <EditorWorkspace />
        <StatusBar />
      </main>
    </TooltipProvider>
  );
}

export function App() {
  return (
    <AppUpdatesProvider>
      <ReduxProvider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <ThemeProvider>
            <EditorContractsProvider>
              <ResizablePanelContextProvider>
                <EasyTrimEditorApp />
              </ResizablePanelContextProvider>
            </EditorContractsProvider>
          </ThemeProvider>
        </PersistGate>
      </ReduxProvider>
    </AppUpdatesProvider>
  );
}
