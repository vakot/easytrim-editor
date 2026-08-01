import { Alert, AlertDescription } from "@/components/ui/alert";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppToolbar } from "@/app/components/AppToolbar";
import { NativeDialogOverlay } from "@/app/components/NativeDialogOverlay";
import { ReturnConfirmationDialog } from "@/app/components/ReturnConfirmationDialog";
import { useClipKitApp } from "@/app/hooks/use-clipkit-app";
import { SourceWorkspace } from "@/features/import-source/SourceWorkspace";
import "./App.css";

function App() {
  const app = useClipKitApp();

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
            exportQueue={app.exportQueue}
            setExportQueue={app.setExportQueue}
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
              Drag and drop is unavailable: {app.dropListenerError}
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

export default App;
