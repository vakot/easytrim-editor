import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Provider as ReduxProvider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResizablePanelContextProvider } from "@/components/ui/resizable";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { AppShutdownGuard } from "@/app/components/AppShutdownGuard";
import { CompactExportQueueWindow } from "@/app/components/CompactExportQueueWindow";
import { CustomTitleBar } from "@/app/components/CustomTitleBar";
import { DiagnosticsRecoveryDialog } from "@/app/components/DiagnosticsRecoveryDialog";
import { EditorWorkspace } from "@/app/components/editor-workspace/EditorWorkspace";
import { ExportQueueWindowToggle } from "@/app/components/ExportQueueWindowToggle";
import { MenuBar } from "@/app/components/menu-bar";
import { NativeDialogOverlay } from "@/app/components/NativeDialogOverlay";
import { PanelVisibilityControls } from "@/app/components/PanelVisibilityControls";
import { AppUpdatesProvider } from "@/app/components/providers/AppUpdatesProvider";
import { EditorContractsProvider } from "@/app/components/providers/EditorContractsProvider";
import { StatusBar } from "@/app/components/status-bar";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectActiveInstanceId,
  selectHasProcessableExports,
} from "@/app/store/slices/editing-instances-slice";
import { selectDropListenerError } from "@/app/store/slices/import-workflow-slice";
import { persistor, store } from "@/app/store/store";
import { loadQueueFinishActions } from "@/app/store/thunks/export-thunks";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { ExportDialog } from "@/features/export";
import { SourceDropOverlay, SourceStatus } from "@/features/source";
import {
  enterCompactWindow,
  restoreEditorWindow,
  type WindowLayoutSnapshot,
} from "@/lib/tauri/window";

function EasyTrimEditorApp() {
  const dispatch = useAppDispatch();
  const dropListenerError = useAppSelector(selectDropListenerError);
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const compactInstanceId = useRef<string | null>(null);
  const { t } = useTranslation();
  const [isCompact, setIsCompact] = useState(false);
  const [isChangingWindowMode, setIsChangingWindowMode] = useState(false);
  const [windowModeError, setWindowModeError] = useState(false);
  const editorWindowSnapshot = useRef<WindowLayoutSnapshot | null>(null);
  const emptyQueueRestoreRequested = useRef(false);
  const hasExportQueueItems = useAppSelector(selectHasProcessableExports);

  useEffect(() => {
    void dispatch(loadQueueFinishActions());
  }, [dispatch]);

  const showEditorWindow = useCallback(() => {
    if (isChangingWindowMode) return;

    setIsChangingWindowMode(true);
    setWindowModeError(false);
    void restoreEditorWindow(editorWindowSnapshot.current)
      .then(() => setIsCompact(false))
      .catch(() => setWindowModeError(true))
      .finally(() => setIsChangingWindowMode(false));
  }, [isChangingWindowMode]);

  useEffect(() => {
    if (!isCompact) {
      emptyQueueRestoreRequested.current = false;
      return;
    }

    if (
      isChangingWindowMode ||
      (hasExportQueueItems && activeInstanceId === compactInstanceId.current) ||
      editorWindowSnapshot.current === null ||
      emptyQueueRestoreRequested.current
    ) {
      return;
    }

    emptyQueueRestoreRequested.current = true;
    setWindowModeError(false);
    showEditorWindow();
  }, [activeInstanceId, hasExportQueueItems, isChangingWindowMode, isCompact, showEditorWindow]);

  const showCompactWindow = () => {
    if (isChangingWindowMode) return;

    setIsChangingWindowMode(true);
    setWindowModeError(false);
    compactInstanceId.current = activeInstanceId;
    setIsCompact(true);
    void enterCompactWindow()
      .then((snapshot) => {
        editorWindowSnapshot.current = snapshot;
      })
      .catch(() => {
        setIsCompact(false);
        setWindowModeError(true);
      })
      .finally(() => setIsChangingWindowMode(false));
  };

  const exportQueueWindowToggle = hasExportQueueItems ? (
    <ExportQueueWindowToggle
      active={false}
      disabled={isChangingWindowMode}
      onClick={showCompactWindow}
    />
  ) : (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex" tabIndex={0}>
          <ExportQueueWindowToggle active={false} disabled onClick={showCompactWindow} />
        </span>
      </TooltipTrigger>
      <TooltipContent>{t("app.tooltips.exportQueueEmpty")}</TooltipContent>
    </Tooltip>
  );

  return (
    <TooltipProvider>
      <AppShutdownGuard />

      {isCompact ? (
        <CompactExportQueueWindow disabled={isChangingWindowMode} onRestore={showEditorWindow} />
      ) : (
        <AppUpdatesProvider>
          <EditorContractsProvider>
            <ResizablePanelContextProvider>
              <main className="fixed inset-0 grid h-dvh w-screen min-w-80 grid-rows-[2.25rem_minmax(0,1fr)_auto] overflow-hidden bg-background">
                <CustomTitleBar
                  menuControls={<MenuBar />}
                  panelControls={
                    <div className="flex items-center gap-0.5">
                      {exportQueueWindowToggle}
                      <PanelVisibilityControls />
                    </div>
                  }
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

                {windowModeError ? (
                  <span className="sr-only" role="alert">
                    {t("app.messages.windowActionFailed")}
                  </span>
                ) : null}
              </main>
            </ResizablePanelContextProvider>
          </EditorContractsProvider>
        </AppUpdatesProvider>
      )}
    </TooltipProvider>
  );
}

export function App() {
  return (
    <ReduxProvider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ThemeProvider>
          <EasyTrimEditorApp />
        </ThemeProvider>
      </PersistGate>
    </ReduxProvider>
  );
}
