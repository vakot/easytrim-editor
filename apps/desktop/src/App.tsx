import { Alert, AlertDescription } from "@/components/ui/alert";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { NativeDialogOverlay } from "@/app/components/NativeDialogOverlay";
import { StatusBar } from "@/app/components/StatusBar";
import { CapabilityStatus, SourceWorkspace } from "@/features/import-source/SourceWorkspace";
import { useTranslation } from "react-i18next";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { CustomTitleBar } from "@/app/components/CustomTitleBar";
import { PanelVisibilityControls } from "@/app/components/PanelVisibilityControls";
import { ContextMenus } from "@/app/components/ContextMenus";
import { OptimizedExportDialog } from "@/features/export/components/OptimizedExportDialog";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  selectCapabilities,
  selectHasSource,
  selectSourceMedia,
  selectSourceReady,
  selectSourceSelection,
} from "@/app/store/slices/source-slice";
import { selectCropApplied } from "@/app/store/slices/crop-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import {
  selectDropListenerError,
  selectIsChoosingSource,
  selectIsNativeDialogOpen,
} from "@/app/store/slices/import-workflow-slice";
import {
  closeSourceRequested,
  chooseSourceRequested,
} from "@/app/store/thunks/source-media-thunks";
import { EditorContractsProvider } from "@/app/components/Providers/EditorContractsProvider";
import { AppUpdatesProvider } from "@/app/components/Providers/AppUpdatesProvider";
import { selectHasQueuedExports, selectQueueStarted } from "@/app/store/slices/export-slice";
import {
  loadQueueFinishActions,
  openOptimizedExportDialog,
  startExportQueue,
  startFastCutRequested,
} from "@/app/store/thunks/export-thunks";
import { persistor, store } from "@/app/store/store";
import { Provider as ReduxProvider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";

function EasyTrimEditorApp() {
  const dispatch = useAppDispatch();
  const sourceSelection = useAppSelector(selectSourceSelection);
  const media = useAppSelector(selectSourceMedia);
  const trim = useAppSelector(selectTrim);
  const capabilities = useAppSelector(selectCapabilities);
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
    (event) =>
      event.key.toLowerCase() === "o" && event.ctrlKey && !isChoosingSource && !isNativeDialogOpen,
    () => void dispatch(chooseSourceRequested()),
  );
  useKeyboardShortcut(
    (event) =>
      event.key.toLowerCase() === "q" &&
      event.ctrlKey &&
      hasSource &&
      !isChoosingSource &&
      !isNativeDialogOpen,
    () => void dispatch(closeSourceRequested()),
  );
  useKeyboardShortcut(
    (event) => event.key.toLowerCase() === "s" && event.ctrlKey && canExport && !cropApplied,
    () => void dispatch(startFastCutRequested()),
  );
  useKeyboardShortcut(
    (event) => event.key.toLowerCase() === "e" && event.ctrlKey && canExport,
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
      <main className="fixed inset-0 grid h-dvh w-screen min-w-80 overflow-hidden bg-background grid-rows-[2.25rem_minmax(0,1fr)_auto]">
        <CustomTitleBar
          menuControls={<ContextMenus />}
          statusContent={<CapabilityStatus capabilities={capabilities} />}
          panelControls={<PanelVisibilityControls />}
        />

        {canExport && sourceSelection && media && trim ? (
          <OptimizedExportDialog showTrigger={false} />
        ) : null}

        {isNativeDialogOpen ? <NativeDialogOverlay /> : null}

        {dropListenerError ? (
          <Alert
            variant="destructive"
            className="fixed top-20 left-1/2 z-50 w-auto -translate-x-1/2"
          >
            <AlertDescription>
              {t("app.dragUnavailable", { message: dropListenerError.message })}
            </AlertDescription>
          </Alert>
        ) : null}

        <SourceWorkspace />
        <StatusBar />
      </main>
    </TooltipProvider>
  );
}

function App() {
  return (
    <AppUpdatesProvider>
      <ThemeProvider>
        <ReduxProvider store={store}>
          <PersistGate loading={null} persistor={persistor}>
            <EditorContractsProvider>
              <EasyTrimEditorApp />
            </EditorContractsProvider>
          </PersistGate>
        </ReduxProvider>
      </ThemeProvider>
    </AppUpdatesProvider>
  );
}

export default App;
