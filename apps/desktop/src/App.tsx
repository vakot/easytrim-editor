import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Provider as ReduxProvider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResizablePanelContextProvider } from "@/components/ui/resizable";
import { TooltipProvider } from "@/components/ui/tooltip";

import { ContextMenus } from "@/app/components/context-menus";
import { CustomTitleBar } from "@/app/components/CustomTitleBar";
import { EditorWorkspace } from "@/app/components/editor-workspace/EditorWorkspace";
import { NativeDialogOverlay } from "@/app/components/NativeDialogOverlay";
import { PanelVisibilityControls } from "@/app/components/PanelVisibilityControls";
import { AppUpdatesProvider } from "@/app/components/providers/AppUpdatesProvider";
import { EditorContractsProvider } from "@/app/components/providers/EditorContractsProvider";
import { StatusBar } from "@/app/components/status-bar";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectCropApplied } from "@/app/store/slices/crop-slice";
import { selectHasQueuedExports, selectQueueStarted } from "@/app/store/slices/export-slice";
import {
  selectDropListenerError,
  selectIsChoosingSource,
  selectIsNativeDialogOpen,
} from "@/app/store/slices/import-workflow-slice";
import { selectHasSource, selectSourceReady } from "@/app/store/slices/source-slice";
import { persistor, store } from "@/app/store/store";
import {
  loadQueueFinishActions,
  openOptimizedExportDialog,
  startExportQueue,
  startFastCutRequested,
} from "@/app/store/thunks/export-thunks";
import {
  chooseSourceRequested,
  closeActiveImportedItemRequested,
} from "@/app/store/thunks/source-media-thunks";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { ExportDialog } from "@/features/export";
import { SourceStatus } from "@/features/source";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";

function EasyTrimEditorApp() {
  const dispatch = useAppDispatch();
  const canExport = useAppSelector(selectSourceReady);
  const cropApplied = useAppSelector(selectCropApplied);
  const queueStarted = useAppSelector(selectQueueStarted);
  const hasQueuedExports = useAppSelector(selectHasQueuedExports);
  const hasSource = useAppSelector(selectHasSource);
  const isChoosingSource = useAppSelector(selectIsChoosingSource);
  const isNativeDialogOpen = useAppSelector(selectIsNativeDialogOpen);
  const dropListenerError = useAppSelector(selectDropListenerError);
  const { t } = useTranslation();

  useEffect(() => {
    void dispatch(loadQueueFinishActions());
  }, [dispatch]);

  useKeyboardShortcut(
    (event) => event.code === "KeyO" && event.ctrlKey && !isChoosingSource && !isNativeDialogOpen,
    () => void dispatch(chooseSourceRequested()),
  );
  useKeyboardShortcut(
    (event) =>
      event.code === "KeyQ" &&
      event.ctrlKey &&
      hasSource &&
      !isChoosingSource &&
      !isNativeDialogOpen,
    () => void dispatch(closeActiveImportedItemRequested()),
  );
  useKeyboardShortcut(
    (event) => event.code === "KeyS" && event.ctrlKey && canExport && !cropApplied,
    () => void dispatch(startFastCutRequested()),
  );
  useKeyboardShortcut(
    (event) => event.code === "KeyE" && event.ctrlKey && canExport,
    () => void dispatch(openOptimizedExportDialog()),
  );
  useKeyboardShortcut(
    (event) =>
      event.key === "Enter" &&
      !queueStarted &&
      hasQueuedExports &&
      document.activeElement === document.body,
    () => void dispatch(startExportQueue()),
  );

  useEffect(() => {
    if (!hasSource) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || isNativeDialogOpen) return;

      const openDialog = document.querySelector<HTMLElement>(
        '[data-slot="dialog-content"][data-state="open"]',
      );

      if (openDialog) {
        openDialog.querySelector<HTMLElement>('[data-slot="dialog-close"]')?.click();
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && activeElement !== document.body) {
        activeElement.blur();
      }
    }

    window.addEventListener("keydown", handleEscape, true);
    return () => window.removeEventListener("keydown", handleEscape, true);
  }, [hasSource, isNativeDialogOpen]);

  return (
    <TooltipProvider>
      <main className="fixed inset-0 grid h-dvh w-screen min-w-80 grid-rows-[2.25rem_minmax(0,1fr)_auto] overflow-hidden bg-background">
        <CustomTitleBar
          menuControls={<ContextMenus />}
          panelControls={<PanelVisibilityControls />}
          statusContent={<SourceStatus />}
        />

        <ExportDialog />

        {isNativeDialogOpen ? <NativeDialogOverlay /> : null}

        {dropListenerError ? (
          <Alert
            className="fixed top-20 left-1/2 z-50 w-auto -translate-x-1/2"
            variant="destructive"
          >
            <AlertDescription>
              {t("app.dragUnavailable", { message: dropListenerError.message })}
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
