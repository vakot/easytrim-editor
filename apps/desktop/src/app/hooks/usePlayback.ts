import { useContext } from "react";

import { EditorPlaybackContext } from "@/app/contexts/editor-contracts-context";

export function usePlayback() {
  const interaction = useContext(EditorPlaybackContext);
  if (!interaction) {
    throw new Error("Playback contracts must be used within EditorContractsProvider.");
  }
  return {
    canInteract: interaction.isPlaybackReady,
    videoRef: interaction.videoRef,
    audioPlayheadRef: interaction.audioPlayheadRef,
    isPlaying: interaction.isPlaying,
    isReady: interaction.isPlaybackReady,
    transportError: interaction.transportError,
    nativeLoopEnabled: interaction.nativeLoopEnabled,
    videoMuted: interaction.videoMuted,
    onLoadedMetadata: interaction.onLoadedMetadata,
    onCanPlay: interaction.onCanPlay,
    onPlay: interaction.onPlay,
    onPause: interaction.onPause,
    onTimeUpdate: interaction.onTimeUpdate,
    onEnded: interaction.onEnded,
    toggle: interaction.onTogglePlayback,
    stepFrame: interaction.onStepFrame,
    setSegmentBoundary: interaction.onSetSegmentBoundary,
    onCropToolOpenChange: interaction.onCropToolOpenChange,
    onPreviewPlaybackError: interaction.onPreviewPlaybackError,
  };
}
