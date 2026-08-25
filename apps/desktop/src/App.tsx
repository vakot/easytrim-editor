import { Alert, AlertDescription } from "@/components/ui/alert";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NativeDialogOverlay } from "@/app/components/NativeDialogOverlay";
import { StatusBar } from "@/app/components/StatusBar";
import { CapabilityStatus, SourceWorkspace } from "@/features/import-source/SourceWorkspace";
import { useTranslation } from "react-i18next";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { EditorViewStateProvider } from "@/app/editor-view-state";
import { useRef } from "react";
import { CustomTitleBar } from "@/app/components/CustomTitleBar";
import { PanelVisibilityControls } from "@/app/components/PanelVisibilityControls";
import { ContextMenus } from "@/app/components/ContextMenus";
import { ExportPanel, type ExportPanelHandle } from "@/features/export";
import { EditorSessionProvider } from "@/app/editor-session-context";
import { useEditorSession } from "@/app/hooks/useEditorSession";
import { EditorContractsProvider } from "@/app/editor-contracts";
import { useSourceDetails } from "@/app/hooks/useSourceDetails";
import { AppUpdatesProvider } from "@/app/AppUpdatesProvider";
import { useEditorViewState } from "@/app/hooks/useEditorViewState";
import { DEFAULT_TOOL_DEFAULTS, type ToolDefaultKey } from "@/app/tool-settings";

function EasyTrimEditorApp() {
  const app = useEditorSession();
  const { toolDefaults, setToolDefault, resetToolDefaults } = useEditorViewState();
  const sourceDetails = useSourceDetails();
  const { t } = useTranslation();
  const source = sourceDetails.source;
  const exportPanelRef = useRef<ExportPanelHandle>(null);
  const canExport = app.session.status === "ready" && Boolean(source?.media && source.trim);
  const cropApplied =
    sourceDetails.crop.x !== 0 ||
    sourceDetails.crop.y !== 0 ||
    sourceDetails.crop.width !== 1 ||
    sourceDetails.crop.height !== 1;
  const canSave = canExport && !cropApplied;
  const handleToolDefaultChange = (key: ToolDefaultKey, enabled: boolean) => {
    setToolDefault(key, enabled);
    if (key === "mergeAudioEnabled" && sourceDetails.sourceId) {
      app.handleSetAudioMerge(sourceDetails.sourceId, enabled);
    }
  };
  const handleResetToolDefaults = () => {
    resetToolDefaults();
    if (sourceDetails.sourceId) {
      app.handleSetAudioMerge(sourceDetails.sourceId, DEFAULT_TOOL_DEFAULTS.mergeAudioEnabled);
    }
  };

  return (
    <TooltipProvider>
      <main className="fixed inset-0 grid h-dvh w-screen min-w-80 overflow-hidden bg-background grid-rows-[2.25rem_minmax(0,1fr)_auto]">
        <CustomTitleBar
          menuControls={
            <ContextMenus
              isChoosingSource={app.isChoosingSource}
              hasSource={app.hasSource}
              canSave={canSave}
              canExport={canExport}
              onChooseSource={() => void app.handleChooseSource()}
              onCloseFile={app.handleCloseFile}
              onSave={() => exportPanelRef.current?.startFastCut()}
              onExport={() => exportPanelRef.current?.openOptimizedDialog()}
              queueStarted={app.queueStarted}
              hasQueuedItems={app.exportQueue.some((toast) => toast.status === "queued")}
              hasActiveItem={app.exportQueue.some((toast) => toast.status === "rendering")}
              onQueueStartedChange={app.setQueueStarted}
              onCancelActive={app.cancelActiveExport}
              onCancelQueue={app.cancelQueue}
              queueFinishAction={app.queueFinishAction}
              availableQueueFinishActions={app.availableQueueFinishActions}
              onQueueFinishActionChange={app.setQueueFinishAction}
              toolDefaults={toolDefaults}
              onToolDefaultChange={handleToolDefaultChange}
              onResetToolDefaults={handleResetToolDefaults}
            />
          }
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
        <EditorViewStateProvider>
          <EditorSessionProvider>
            <EditorContractsProvider>
              <EasyTrimEditorApp />
            </EditorContractsProvider>
          </EditorSessionProvider>
        </EditorViewStateProvider>
      </ThemeProvider>
    </AppUpdatesProvider>
  );
}

export default App;
