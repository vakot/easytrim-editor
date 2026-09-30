import { useContext } from "react";

import { EditorPlaybackContext } from "@/app/contexts/editor-contracts-context";

function usePlayback() {
  const interaction = useContext(EditorPlaybackContext);
  if (!interaction) {
    throw new Error("Playback contracts must be used within EditorContractsProvider.");
  }
  return {
    canInteract: interaction.isPlaybackReady,
    videoRef: interaction.videoRef,
    isPlaying: interaction.isPlaying,
    isReady: interaction.isPlaybackReady,
    transportError: interaction.transportError,
    nativeLoopEnabled: interaction.nativeLoopEnabled,
    pause: interaction.onPausePlayback,
    videoMuted: interaction.videoMuted,
    onLoadedMetadata: interaction.onLoadedMetadata,
    onCanPlay: interaction.onCanPlay,
    onPlay: interaction.onPlay,
    onPause: interaction.onPause,
    onTimeUpdate: interaction.onTimeUpdate,
    onEnded: interaction.onEnded,
    toggle: interaction.onTogglePlayback,
    setMediaPlaybackRate: interaction.setMediaPlaybackRate,
    setVideoElement: interaction.setVideoElement,
    stepFrame: interaction.onStepFrame,
    startShuttle: interaction.onShuttleStart,
    stopShuttle: interaction.onShuttleEnd,
    shuttleDirection: interaction.shuttleDirection,
    onCropToolOpenChange: interaction.onCropToolOpenChange,
    onPreviewPlaybackError: interaction.onPreviewPlaybackError,
  };
}

export { usePlayback };
