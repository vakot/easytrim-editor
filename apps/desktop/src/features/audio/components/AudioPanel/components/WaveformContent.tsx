import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { AudioTrackState } from "@/app/store/slices/audio-slice";

interface WaveformContentProps {
  onImageError: () => void;
  onRetry: () => void;
  track: AudioTrackState;
}

export function WaveformContent({ onImageError, onRetry, track }: WaveformContentProps) {
  const { t } = useTranslation();

  switch (track.waveform.status) {
    case "idle":
    case "loading":
      return (
        <span
          className="absolute inset-0 grid place-items-center text-xs text-muted-foreground"
          role="status"
        >
          {t("audio.status.preparingWaveform")}
        </span>
      );
    case "ready":
      return (
        <img
          alt=""
          aria-hidden="true"
          className="waveform-image absolute inset-0 size-full object-fill"
          draggable={false}
          onError={onImageError}
          src={track.waveform.url}
        />
      );
    case "failed":
      return (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{t("audio.status.waveformUnavailable")}</span>
            </TooltipTrigger>
            <TooltipContent>{track.waveform.error.message}</TooltipContent>
          </Tooltip>
          <Button onClick={onRetry} size="xs" type="button" variant="ghost">
            {t("common.actions.retry")}
          </Button>
        </div>
      );
  }
}
