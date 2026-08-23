import { Alert, AlertDescription } from "@/components/ui/alert";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppToolbar } from "@/app/components/AppToolbar";
import { NativeDialogOverlay } from "@/app/components/NativeDialogOverlay";
import { ReturnConfirmationDialog } from "@/app/components/ReturnConfirmationDialog";
import { StatusBar } from "@/app/components/StatusBar";
import { useEasyTrimEditorApp } from "@/app/hooks/useEasyTrimEditorApp";
import { SourceWorkspace } from "@/features/import-source/SourceWorkspace";
import { useTranslation } from "react-i18next";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { useReleaseCheck } from "@/features/release/hooks/useReleaseCheck";
import { EditorViewStateProvider } from "@/app/editor-view-state";
import { useEffect, useState } from "react";
import { FULL_CROP, type CropRect } from "@/features/preview/utils/crop-geometry";
import { CustomTitleBar } from "@/app/components/CustomTitleBar";
import { PanelVisibilityControls } from "@/app/components/PanelVisibilityControls";

function EasyTrimEditorApp() {
  const app = useEasyTrimEditorApp();
  const { t } = useTranslation();
  const { update } = useReleaseCheck();
  const source = app.session.source;
  const sourceDimensions = source?.media
    ? { width: source.media.video.width, height: source.media.video.height }
    : null;
  const [cropResolution, setCropResolution] = useState(sourceDimensions ?? { width: 1, height: 1 });
  const [crop, setCrop] = useState<CropRect>(FULL_CROP);

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
            ? "grid-rows-[2.25rem_auto_minmax(0,1fr)_auto]"
            : "grid-rows-[2.25rem_minmax(0,1fr)]"
        }`}
      >
        <CustomTitleBar
          onLogoClick={app.requestReturnToWelcome}
          panelControls={
            app.hasSource ? (
              <PanelVisibilityControls
                hasAudioTracks={Boolean(source?.media?.audioStreams.length)}
              />
            ) : null
          }
        />
        {app.hasSource ? (
          <AppToolbar
            session={app.session}
            isChoosingSource={app.isChoosingSource}
            setExportQueue={app.setExportQueue}
            exportPresets={app.exportPresets}
            dispatchExportPreset={app.dispatchExportPreset}
            onChooseSource={() => void app.handleChooseSource()}
            onReturnToWelcome={app.requestReturnToWelcome}
            onNativeDialogStateChange={app.setIsNativeDialogOpen}
            cropResolution={cropResolution}
            crop={crop}
          />
        ) : null}

        <ReturnConfirmationDialog
          open={app.isReturnConfirmationOpen}
          onCancel={() => app.setIsReturnConfirmationOpen(false)}
          onConfirm={() => {
            app.setIsReturnConfirmationOpen(false);
            app.handleReturnToWelcome();
          }}
        />

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

        <SourceWorkspace
          session={app.session}
          isChoosingSource={app.isChoosingSource}
          isSourceDragActive={app.isSourceDragActive}
          onChooseSource={() => void app.handleChooseSource()}
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
          update={update}
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
