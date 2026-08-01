import { Alert, AlertDescription } from "@/components/ui/alert";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppToolbar } from "@/app/components/AppToolbar";
import { NativeDialogOverlay } from "@/app/components/NativeDialogOverlay";
import { ReturnConfirmationDialog } from "@/app/components/ReturnConfirmationDialog";
import { useClipKitApp } from "@/app/hooks/use-clipkit-app";
import { SourceWorkspace } from "@/features/import-source/SourceWorkspace";
import { useTranslation } from "react-i18next";
import { ThemeProvider } from "@/app/theme/ThemeProvider";

function ClipKitApp() {
  const app = useClipKitApp();
  const { t } = useTranslation();

  return (
    <TooltipProvider>
      <main
        className={`fixed inset-0 grid h-dvh w-screen min-w-80 overflow-hidden bg-background ${
          app.hasSource ? "grid-rows-[auto_minmax(0,1fr)]" : "grid-rows-1"
        }`}
      >
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
        />
      </main>
    </TooltipProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ClipKitApp />
    </ThemeProvider>
  );
}

export default App;
