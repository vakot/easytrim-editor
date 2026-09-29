import { Volume2, VolumeOff } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { cn } from "@/lib/class-names.utils";
import { diagnostics } from "@/lib/diagnostics";

import type { AudioTrackController } from "../../../hooks/useAudioTrackController";

type AudioTrackToggleProps = ComponentPropsWithoutRef<typeof Button> & {
  controller: AudioTrackController;
};

const AudioTrackToggle = forwardRef<HTMLButtonElement, AudioTrackToggleProps>(
  function AudioTrackToggle({ className, controller, onClick, ...props }, ref) {
    const { t } = useTranslation();
    const { setEnabled, stream, track, trackNumber } = controller;
    if (!stream || !track) return null;
    const title =
      stream.title ?? stream.language ?? t("audio.labels.defaultTrack", { number: trackNumber });

    const label = track.enabled
      ? t("audio.actions.muteTrack", { title })
      : t("audio.actions.unmuteTrack", { title });

    return (
      <Tooltip preserveOnTrigger>
        <TooltipTrigger asChild>
          <Button
            aria-label={label}
            aria-pressed={track.enabled}
            className={cn("text-primary", className)}
            onClick={(event) => {
              diagnostics.action(
                "audio.track.toggle.requested",
                { type: "button", id: "track-toggle" },
                { streamIndex: stream.streamIndex },
              );
              setEnabled();
              onClick?.(event);
            }}
            ref={ref}
            size="icon-sm"
            type="button"
            variant="ghost"
            {...props}
          >
            {track.enabled ? <Volume2 /> : <VolumeOff />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  },
);

export { AudioTrackToggle };
