import { Alert, AlertDescription } from "@/components/ui/alert";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NativeDialogOverlay } from "@/app/components/NativeDialogOverlay";
import { StatusBar } from "@/app/components/StatusBar";
import { CapabilityStatus, SourceWorkspace } from "@/features/import-source/SourceWorkspace";
import { useTranslation } from "react-i18next";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { EditorViewStateProvider } from "@/app/editor-view-state";
import { CustomTitleBar } from "@/app/components/CustomTitleBar";
import { PanelVisibilityControls } from "@/app/components/PanelVisibilityControls";
import { ContextMenus } from "@/app/components/ContextMenus";
import { ExportPanel } from "@/features/export";
import { EditorSessionProvider } from "@/app/components/Providers/EditorSessionProvider";
import { useEditorSession } from "@/app/hooks/useEditorSession";
import { EditorContractsProvider } from "@/app/components/Providers/EditorContractsProvider";
import { useSourceDetails } from "@/app/hooks/useSourceDetails";
import { AppUpdatesProvider } from "@/app/components/Providers/AppUpdatesProvider";
import { ExportPanelControllerProvider } from "@/app/components/Providers/ExportPanelControllerProvider";
import { useExportPanelController } from "@/app/hooks/useExportPanelController";
import { persistor, store } from "@/app/store/store";
import { Provider as ReduxProvider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";

function EasyTrimEditorApp() {
  const app = useEditorSession();
  const sourceDetails = useSourceDetails();
  const { t } = useTranslation();
  const source = sourceDetails.source;
  const { panelRef: exportPanelRef } = useExportPanelController();
  const canExport = app.session.status === "ready" && Boolean(source?.media && source.trim);

  return (
    <TooltipProvider>
      <main className="fixed inset-0 grid h-dvh w-screen min-w-80 overflow-hidden bg-background grid-rows-[2.25rem_minmax(0,1fr)_auto]">
        <CustomTitleBar
          menuControls={<ContextMenus />}
          statusContent={<CapabilityStatus capabilities={app.session.capabilities} />}
          panelControls={<PanelVisibilityControls />}
        />

        {canExport && source?.media && source.trim ? (
          <ExportPanel
            key={`export-${source.selection.sourceId}`}
            ref={exportPanelRef}
            source={source.media}
            sourceName={source.selection.displayName}
            trim={source.trim}
            audioTracks={source.audioTracks}
            masterEnabled={source.masterEnabled}
            masterVolumePercent={source.masterVolumePercent}
            mergeAudio={source.mergeAudio}
            setQueue={app.setExportQueue}
            presetState={app.exportPresets}
            onPresetAction={app.dispatchExportPreset}
            onNativeDialogStateChange={app.setIsNativeDialogOpen}
            cropResolution={sourceDetails.cropResolution}
            crop={sourceDetails.crop}
            showActions={false}
          />
        ) : null}

        {app.isNativeDialogOpen ? <NativeDialogOverlay /> : null}

        {app.dropListenerError ? (
          <Alert
            variant="destructive"
            className="fixed top-20 left-1/2 z-50 w-auto -translate-x-1/2"
          >
            <AlertDescription>
              {t("app.dragUnavailable", { message: app.dropListenerError })}
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
            <EditorViewStateProvider>
              <EditorSessionProvider>
                <ExportPanelControllerProvider>
                  <EditorContractsProvider>
                    <EasyTrimEditorApp />
                  </EditorContractsProvider>
                </ExportPanelControllerProvider>
              </EditorSessionProvider>
            </EditorViewStateProvider>
          </PersistGate>
        </ReduxProvider>
      </ThemeProvider>
    </AppUpdatesProvider>
  );
}

export default App;
