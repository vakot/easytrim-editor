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
import { ExportPanel } from "@/features/export";
import { EditorSessionProvider } from "@/app/components/Providers/EditorSessionProvider";
import { useEditorSession } from "@/app/hooks/useEditorSession";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  selectCapabilities,
  selectHasSource,
  selectSourceMedia,
  selectSourceReady,
  selectSourceSelection,
} from "@/app/store/slices/source-slice";
import { selectCrop, selectCropResolution } from "@/app/store/slices/crop-slice";
import {
  selectAudioTracks,
  selectMasterAudio,
  selectMergeAudio,
} from "@/app/store/slices/audio-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import {
  selectDropListenerError,
  selectIsChoosingSource,
  selectIsNativeDialogOpen,
  nativeDialogStateChanged,
} from "@/app/store/slices/import-workflow-slice";
import {
  closeSourceRequested,
  chooseSourceRequested,
} from "@/app/store/thunks/source-media-thunks";
import { EditorContractsProvider } from "@/app/components/Providers/EditorContractsProvider";
import { AppUpdatesProvider } from "@/app/components/Providers/AppUpdatesProvider";
import { ExportPanelControllerProvider } from "@/app/components/Providers/ExportPanelControllerProvider";
import { useExportPanelController } from "@/app/hooks/useExportPanelController";
import { persistor, store } from "@/app/store/store";
import { Provider as ReduxProvider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";

function EasyTrimEditorApp() {
  const app = useEditorSession();
  const dispatch = useAppDispatch();
  const sourceSelection = useAppSelector(selectSourceSelection);
  const media = useAppSelector(selectSourceMedia);
  const trim = useAppSelector(selectTrim);
  const audioTracks = useAppSelector(selectAudioTracks);
  const masterAudio = useAppSelector(selectMasterAudio);
  const crop = useAppSelector(selectCrop);
  const cropResolution = useAppSelector(selectCropResolution);
  const capabilities = useAppSelector(selectCapabilities);
  const canExport = useAppSelector(selectSourceReady);
  const mergeAudio = useAppSelector(selectMergeAudio);
  const hasSource = useAppSelector(selectHasSource);
  const isChoosingSource = useAppSelector(selectIsChoosingSource);
  const isNativeDialogOpen = useAppSelector(selectIsNativeDialogOpen);
  const dropListenerError = useAppSelector(selectDropListenerError);
  const { t } = useTranslation();
  const { panelRef: exportPanelRef } = useExportPanelController();

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
          <ExportPanel
            key={`export-${sourceSelection.sourceId}`}
            ref={exportPanelRef}
            source={media}
            sourceName={sourceSelection.displayName}
            trim={trim}
            audioTracks={audioTracks}
            masterEnabled={masterAudio.enabled}
            masterVolumePercent={masterAudio.volumePercent}
            mergeAudio={mergeAudio}
            setQueue={app.setExportQueue}
            presetState={app.exportPresets}
            onPresetAction={app.dispatchExportPreset}
            onNativeDialogStateChange={(open) => dispatch(nativeDialogStateChanged(open))}
            cropResolution={cropResolution}
            crop={crop}
            showActions={false}
          />
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
        <StatusBar queue={app.exportQueue} />
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
            <EditorSessionProvider>
              <ExportPanelControllerProvider>
                <EditorContractsProvider>
                  <EasyTrimEditorApp />
                </EditorContractsProvider>
              </ExportPanelControllerProvider>
            </EditorSessionProvider>
          </PersistGate>
        </ReduxProvider>
      </ThemeProvider>
    </AppUpdatesProvider>
  );
}

export default App;
