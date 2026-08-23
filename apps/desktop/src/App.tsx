import { Alert, AlertDescription } from "@/components/ui/alert";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NativeDialogOverlay } from "@/app/components/NativeDialogOverlay";
import { StatusBar } from "@/app/components/StatusBar";
import { useEasyTrimEditorApp } from "@/app/hooks/useEasyTrimEditorApp";
import { CapabilityStatus, SourceWorkspace } from "@/features/import-source/SourceWorkspace";
import { useTranslation } from "react-i18next";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { useReleaseCheck } from "@/features/release/hooks/useReleaseCheck";
import { EditorViewStateProvider } from "@/app/editor-view-state";
import { useEffect, useRef, useState } from "react";
import { FULL_CROP, type CropRect } from "@/features/preview/utils/crop-geometry";
import { CustomTitleBar } from "@/app/components/CustomTitleBar";
import { PanelVisibilityControls } from "@/app/components/PanelVisibilityControls";
import { TopBarMenus } from "@/app/components/TopBarMenus";
import { ExportPanel, type ExportPanelHandle } from "@/features/export";

function EasyTrimEditorApp() {
  const app = useEasyTrimEditorApp();
  const { t } = useTranslation();
  const { update } = useReleaseCheck();
  const source = app.session.source;
  const exportPanelRef = useRef<ExportPanelHandle>(null);
  const sourceDimensions = source?.media
    ? { width: source.media.video.width, height: source.media.video.height }
    : null;
  const [cropResolution, setCropResolution] = useState(sourceDimensions ?? { width: 1, height: 1 });
  const [crop, setCrop] = useState<CropRect>(FULL_CROP);
  const canExport = app.session.status === "ready" && Boolean(source?.media && source.trim);
  const cropApplied = crop.x !== 0 || crop.y !== 0 || crop.width !== 1 || crop.height !== 1;
  const canSave = canExport && !cropApplied;

  useEffect(() => {
    // Crop dimensions are session UI state derived from the active source.
    if (source?.media) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCropResolution({ width: source.media.video.width, height: source.media.video.height });
      setCrop(FULL_CROP);
    }
  }, [source?.media, source?.selection.sourceId]);

  return (
    <TooltipProvider>
      <main
        className={`fixed inset-0 grid h-dvh w-screen min-w-80 overflow-hidden bg-background ${
          app.hasSource
            ? "grid-rows-[2.25rem_minmax(0,1fr)_auto]"
            : "grid-rows-[2.25rem_minmax(0,1fr)]"
        }`}
      >
        <CustomTitleBar
          menuControls={
            <TopBarMenus
              isChoosingSource={app.isChoosingSource}
              canSave={canSave}
              canExport={canExport}
              onChooseSource={() => void app.handleChooseSource()}
              onSave={() => exportPanelRef.current?.startFastCut()}
              onExport={() => exportPanelRef.current?.openOptimizedDialog()}
            />
          }
          statusContent={<CapabilityStatus capabilities={app.session.capabilities} />}
          panelControls={
            <PanelVisibilityControls
              hasAudioTracks={Boolean(source?.media?.audioStreams.length) || !app.hasSource}
            />
          }
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
            cropResolution={cropResolution}
            crop={crop}
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

        {!app.hasSource && app.session.lastError ? (
          <Alert
            variant="destructive"
            className="fixed top-20 left-1/2 z-50 w-auto -translate-x-1/2"
          >
            <AlertDescription>{app.session.lastError.message}</AlertDescription>
          </Alert>
        ) : null}

        <SourceWorkspace
          session={app.session}
          isSourceDragActive={app.isSourceDragActive}
          onPreviewPlaybackError={app.handlePreviewPlaybackError}
          onTrimChange={app.handleTrimChange}
          onPrepareWaveforms={app.handlePrepareWaveforms}
          onToggleAudioTrack={app.handleToggleAudioTrack}
          onAudioTrackVolumeChange={app.handleAudioTrackVolumeChange}
          onToggleAudioMaster={app.handleToggleAudioMaster}
          onMasterVolumeChange={app.handleMasterVolumeChange}
          onToggleAudioMerge={app.handleToggleAudioMerge}
          onWaveformImageError={app.handleWaveformImageError}
          audioPreviewUrls={app.audioPreviewUrls}
          exportQueue={app.exportQueue}
          onCropResolutionChange={setCropResolution}
          onCropChange={setCrop}
        />
        {app.hasSource ? <StatusBar update={update} queue={app.exportQueue} /> : null}
      </main>
    </TooltipProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <EditorViewStateProvider>
        <EasyTrimEditorApp />
      </EditorViewStateProvider>
    </ThemeProvider>
  );
}

export default App;
