import type { AudioTrackState } from "@/app/session-state";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";

interface WaveformContentProps {
  track: AudioTrackState;
  onRetry: () => void;
  onImageError: () => void;
}

export function WaveformContent({ track, onRetry, onImageError }: WaveformContentProps) {
  const { t } = useTranslation();

  switch (track.waveform.status) {
    case "idle":
    case "loading":
      return (
        <span
          className="absolute inset-0 grid place-items-center text-xs text-muted-foreground"
          role="status"
        >
          {t("audio.preparingWaveform")}
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
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{t("audio.waveformUnavailable")}</span>
            </TooltipTrigger>
            <TooltipContent>{track.waveform.error.message}</TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="xs" type="button" onClick={onRetry}>
            {t("common.retry")}
          </Button>
        </div>
      );
  }
}
