import { useEditorInteraction } from "./useEditorInteraction";

export function usePlayback() {
  const interaction = useEditorInteraction();
  return {
    videoRef: interaction.videoRef,
    audioPlayheadRef: interaction.audioPlayheadRef,
    displayedPlayheadMicros: interaction.displayedPlayheadMicros,
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
    onScrubStart: interaction.onScrubStart,
    onScrub: interaction.onScrub,
    onScrubEnd: interaction.onScrubEnd,
    toggle: interaction.onTogglePlayback,
    stepFrame: interaction.onStepFrame,
    setSegmentBoundary: interaction.onSetSegmentBoundary,
    onCropToolOpenChange: interaction.onCropToolOpenChange,
    onPreviewPlaybackError: interaction.onPreviewPlaybackError,
  };
}
