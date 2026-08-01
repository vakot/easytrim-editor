import type { AudioTrackState } from "@/app/session-state";
import { Button } from "@/components/ui/button";

interface WaveformContentProps {
  track: AudioTrackState;
  onRetry: () => void;
  onImageError: () => void;
}

export function WaveformContent({ track, onRetry, onImageError }: WaveformContentProps) {
  switch (track.waveform.status) {
    case "idle":
    case "loading":
      return (
        <span
          className="absolute inset-0 grid place-items-center text-xs text-muted-foreground"
          role="status"
        >
          Preparing waveform…
        </span>
      );
    case "ready":
      return (
        <img
          className="waveform-image absolute inset-0 size-full object-fill"
          src={track.waveform.url}
          alt=""
          aria-hidden="true"
          draggable={false}
          onError={onImageError}
        />
      );
    case "failed":
      return (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span title={track.waveform.error.message}>Waveform unavailable</span>
          <Button variant="ghost" size="xs" type="button" onClick={onRetry}>
            Retry
          </Button>
        </div>
      );
  }
}
