import { memo } from "react";

import { useAudioTrackController } from "../../hooks/useAudioTrackController";

import { AudioTrackDetails } from "./components/AudioTrackDetails";
import { AudioTrackToggle } from "./components/AudioTrackToggle";

const AudioTrackRow = memo(function AudioTrackRow({ streamIndex }: { streamIndex: number }) {
  const { stream, track } = useAudioTrackController(streamIndex);

  if (!track || !stream) return null;

  return (
    <div
      className="grid min-w-0 grid-cols-(--editor-timeline-track-grid-columns) gap-3"
      data-slot="audio-track-row"
    >
      <div className="flex items-center gap-1">
        <AudioTrackToggle streamIndex={streamIndex} />
        <AudioTrackDetails streamIndex={streamIndex} />
      </div>

      <div
        className="relative size-full h-12.5 min-w-0 overflow-hidden rounded-lg border border-border bg-muted/30 text-muted transition-opacity data-[enabled=false]:opacity-50"
        data-enabled={track.enabled}
      />
    </div>
  );
});

export { AudioTrackRow };
