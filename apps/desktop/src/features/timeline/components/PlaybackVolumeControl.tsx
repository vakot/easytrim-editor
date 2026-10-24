import { Volume1, Volume2, VolumeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@easytrim-editor/ui/class-names";

import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  playbackVolumeChanged,
  playbackVolumeToggled,
  selectPlaybackVolumePercent,
} from "@/app/store/slices/preferences-slice";
import { useAudioPlaybackAdapter } from "@/features/audio";

function PlaybackVolumeControl() {
  return (
    <HoverCard closeDelay={100} openDelay={0} preserveOnTrigger>
      <HoverCardTrigger>
        <PlaybackVolumeControlToggle />
      </HoverCardTrigger>

      <HoverCardContent align="center" className="max-w-42" side="right">
        <PlaybackVolumeControlSlider />
      </HoverCardContent>
    </HoverCard>
  );
}

function PlaybackVolumeControlToggle() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const volumePercent = useAppSelector(selectPlaybackVolumePercent);
  const enabled = volumePercent > 0;

  return (
    <Tooltip preserveOnTrigger>
      <TooltipTrigger asChild>
        <Button
          aria-label={enabled ? t("audio.tracks.mute") : t("audio.tracks.unmute")}
          aria-pressed={enabled}
          className={cn(enabled && "text-primary")}
          onClick={() => dispatch(playbackVolumeToggled())}
          size="icon-sm"
          type="button"
          variant="secondary"
        >
          {enabled ? volumePercent >= 50 ? <Volume2 /> : <Volume1 /> : <VolumeOff />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {enabled
          ? t("preview.playback.playbackVolumeMuteTooltip")
          : t("preview.playback.playbackVolumeUnmuteTooltip")}
      </TooltipContent>
    </Tooltip>
  );
}

/** Previews the volume while it is dragged and stores it in Preferences once it is released. */
function PlaybackVolumeControlSlider() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const committedVolumePercent = useAppSelector(selectPlaybackVolumePercent);
  const { setLiveOutputVolume } = useAudioPlaybackAdapter();
  const [draftVolumePercent, setDraftVolumePercent] = useState<number | null>(null);
  const volumePercent = draftVolumePercent ?? committedVolumePercent;
  // A drag interrupted by closing the card must not leave the preview at its draft volume.
  useEffect(() => () => setLiveOutputVolume(null), [setLiveOutputVolume]);

  return (
    <div className="flex items-center gap-1">
      <Slider
        aria-label={t("preview.playback.volume")}
        max={100}
        min={0}
        onValueChange={([value]) => {
          if (value === undefined) return;
          setDraftVolumePercent(value);
          setLiveOutputVolume(value);
        }}
        onValueCommit={([value]) => {
          if (value !== undefined) dispatch(playbackVolumeChanged(value));
          setDraftVolumePercent(null);
        }}
        step={1}
        value={[volumePercent]}
      />
      <output className="w-[5ch] shrink-0 text-right text-xs text-muted-foreground tabular-nums">
        {volumePercent}%
      </output>
    </div>
  );
}

export { PlaybackVolumeControl };
